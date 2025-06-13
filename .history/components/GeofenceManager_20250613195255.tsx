"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { Layer, Circle, Polygon, LatLng } from "leaflet";

/* ──────────────────────── UI ──────────────────────── */
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Search,
  Plus,
  Trash2,
  MapPin,
  Car,
  Loader2,
  RefreshCw,
  Save,
  X,
  Circle as CircleIcon,
  Square,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

/* ──────────────────────── Constants ──────────────────────── */
import { API_BASE_URL } from "../api/file";
const ENDPOINT = {
  geofence: `${API_BASE_URL}/items/geofence`,
  vehicle: `${API_BASE_URL}/items/vehicle`,
};
const DEFAULT_CENTER: [number, number] = [-2.5, 118.0];
const DATA_REFRESH_INTERVAL = 30_000;

/* ──────────────────────── Types ──────────────────────── */
export interface Geofence {
  geofence_id: number;
  user_id: string;
  name: string;
  type: "circle" | "polygon" | string;
  rule_type: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  status: "active" | "inactive";
  definition: {
    coordinates?: number[][][];
    center?: number[];
    radius?: number;
  };
  date_created: string;
}
export interface Vehicle {
  vehicle_id: string;
  user_id: string;
  gps_id: string;
  name: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  geofence_id: string | null;
}

/* ──────────────────────── Utils ──────────────────────── */
const json = (r: Response) => r.text().then((t) => (t ? JSON.parse(t) : {}));
const ensureArr = <T,>(v: any): T[] => (Array.isArray(v) ? v : v?.data ?? []);
const validate = (g: Geofence | undefined) =>
  g?.definition && (g.type.includes("circle") || g.type.includes("polygon"));
const centerOf = (g?: Geofence): [number, number] => {
  if (!g || !validate(g)) return DEFAULT_CENTER;
  if (g.type.includes("circle")) {
    const [lng, lat] = g.definition.center!;
    return [lat, lng];
  }
  const pts = g.definition.coordinates![0];
  const [lng, lat] = pts.reduce(
    (acc, [x, y]) => [acc[0] + x, acc[1] + y],
    [0, 0]
  ).map((s) => s / pts.length) as [number, number];
  return [lat, lng];
};

/* ──────────────────────── Hooks ──────────────────────── */
function useAbortableFetch() {
  const ctrl = useRef<AbortController>();
  return useCallback(async (url: string, init?: RequestInit) => {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    const res = await fetch(url, { ...init, signal: ctrl.current.signal });
    if (!res.ok) throw new Error(res.statusText);
    return json(res);
  }, []);
}

function useAutoRefresh(cb: () => void, deps: unknown[]) {
  useEffect(() => {
    const id = setInterval(cb, DATA_REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ──────────────────────── Map (dynamic) ──────────────────────── */
const MapWithDrawing = dynamic(() => import("./MapWithDrawing"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  ),
});

/* ──────────────────────── Main Component ──────────────────────── */
export default function GeofenceManager() {
  /*  State  */
  const [user] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const fetcher = useAbortableFetch();

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [current, setCurrent] = useState<Geofence | null>(null);
  const [creating, setCreating] = useState(false);
  const [drawn, setDrawn] = useState<Layer[]>([]);
  const [form, setForm] = useState({ name: "", rule: "FORBIDDEN", type: "polygon" });
  const [assignDlg, setAssignDlg] = useState(false);
  const [assigned, setAssigned] = useState<string[]>([]);

  /*  Fetch helpers  */
  const getGeofences = useCallback(async () => {
    if (!user) return;
    const r = await fetcher(`${ENDPOINT.geofence}?filter[user_id][_eq]=${user.id}&limit=-1`);
    const data = ensureArr<Geofence>(r);
    setGeofences(data.filter(validate));
  }, [fetcher, user]);

  const getVehicles = useCallback(async () => {
    if (!user) return;
    const r = await fetcher(`${ENDPOINT.vehicle}?filter[user_id][_eq]=${user.id}&limit=-1`);
    setVehicles(ensureArr<Vehicle>(r));
  }, [fetcher, user]);

  /*  Initial + auto refresh  */
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([getGeofences(), getVehicles()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [getGeofences, getVehicles]);
  useAutoRefresh(() => {
    if (!creating) getGeofences();
  }, [creating, getGeofences]);

  /*  Derived  */
  const display = useMemo(() => (
    creating || !current ? [] : [current]
  ), [creating, current]);

  /*  Handlers  */
  const saveGeofence = async () => {
    if (!user || !drawn.length || !form.name.trim()) return toast.error("Incomplete form");
    const layer = drawn[0];
    let def: any = {};
    let type: "circle" | "polygon" = form.type as any;
    if ((layer as Circle).getRadius) {
      const c = (layer as Circle).getLatLng();
      def = { type: "Circle", center: [c.lng, c.lat], radius: (layer as Circle).getRadius() };
      type = "circle";
    } else if ((layer as Polygon).getLatLngs) {
      const coords = ((layer as Polygon).getLatLngs()[0] as LatLng[]).map((l) => [l.lng, l.lat]);
      def = { type: "Polygon", coordinates: [[...coords, coords[0]]] };
      type = "polygon";
    }
    const body = JSON.stringify({
      user_id: user.id,
      name: form.name.trim(),
      type,
      rule_type: form.rule,
      status: "active",
      definition: def,
      date_created: new Date().toISOString(),
    });
    try {
      await fetch(ENDPOINT.geofence, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      toast.success("Geofence saved");
      setCreating(false);
      setDrawn([]);
      setForm({ name: "", rule: "FORBIDDEN", type: "polygon" });
      await getGeofences();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteGeofence = async (id: number) => {
    if (!confirm("Delete geofence?")) return;
    await fetch(`${ENDPOINT.geofence}/${id}`, { method: "DELETE" });
    await getGeofences();
    if (current?.geofence_id === id) setCurrent(null);
  };

  const assignVehicles = async () => {
    const promises = vehicles.map((v) =>
      fetch(`${ENDPOINT.vehicle}/${v.vehicle_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geofence_id: assigned.includes(v.vehicle_id.toString()) ? current?.geofence_id : null }),
      })
    );
    await Promise.all(promises);
    toast.success("Assignments saved");
    setAssignDlg(false);
    await getVehicles();
  };

  /*  Render helpers  */
  const RuleBadge = ({ r }: { r: Geofence["rule_type"] }) => (
    <Badge variant="outline" className={{ FORBIDDEN: "bg-rose-100", STAY_IN: "bg-indigo-100", STANDARD: "bg-teal-100" }[r] + " text-xs"}>
      {r}
    </Badge>
  );

  /* ──────────────────────── JSX ──────────────────────── */
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold">Geofence Manager</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => getGeofences()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Sidebar */}
        <div className="space-y-2 max-h-[75vh] overflow-auto">
          {!creating && geofences.map((g) => (
            <Card
              key={g.geofence_id}
              onClick={() => (setCurrent(g), setCreating(false))}
              className={`cursor-pointer ${current?.geofence_id === g.geofence_id ? "ring-2 ring-blue-500" : ""}`}
            >
              <CardContent className="p-3 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{g.name}</span>
                  <RuleBadge r={g.rule_type} />
                </div>
                <div className="flex gap-2 text-xs text-slate-500">
                  <Badge>{g.type}</Badge>
                  <Badge>{g.status}</Badge>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => (setAssignDlg(true), setCurrent(g))}>
                    <Car className="h-4 w-4 mr-1" /> Assign
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteGeofence(g.geofence_id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {creating && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {form.type === "polygon" ? <Square /> : <CircleIcon />} Create Geofence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Select value={form.rule} onValueChange={(v) => setForm({ ...form, rule: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Rule" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["FORBIDDEN", "STAY_IN", "STANDARD"] as const).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant={form.type === "polygon" ? "default" : "outline"} onClick={() => setForm({ ...form, type: "polygon" })} className="flex-1">
                    <Square className="h-4 w-4 mr-1" /> Polygon
                  </Button>
                  <Button variant={form.type === "circle" ? "default" : "outline"} onClick={() => setForm({ ...form, type: "circle" })} className="flex-1">
                    <CircleIcon className="h-4 w-4 mr-1" /> Circle
                  </Button>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={saveGeofence}>
                    <Save className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Map */}
        <div className="lg:col-span-2 h-[60vh] lg:h-auto">
          <MapWithDrawing
            center={centerOf(current || undefined)}
            zoom={creating ? 5 : current ? 13 : 5}
            drawMode={creating ? form.type : undefined}
            onDrawCreated={(e) => (setDrawn([e.layer]), setForm({ ...form, type: e.layerType }))}
            onDrawDeleted={() => setDrawn([])}
            viewOnly={!creating}
            geofences={display}
            selectedGeofence={current}
            isCreating={creating}
            drawnLayersForEditing={creating ? drawn : undefined}
          />
        </div>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDlg} onOpenChange={setAssignDlg}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Vehicles</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-60 overflow-auto">
            {vehicles.map((v) => (
              <div
                key={v.vehicle_id}
                className="flex items-center gap-2 p-2 border rounded cursor-pointer"
                onClick={() =>
                  setAssigned((p) =>
                    p.includes(v.vehicle_id.toString())
                      ? p.filter((id) => id !== v.vehicle_id.toString())
                      : [...p, v.vehicle_id.toString()]
                  )
                }
              >
                <Checkbox checked={assigned.includes(v.vehicle_id.toString())} />
                <span>{v.name}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDlg(false)}>
              Cancel
            </Button>
            <Button onClick={assignVehicles}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
