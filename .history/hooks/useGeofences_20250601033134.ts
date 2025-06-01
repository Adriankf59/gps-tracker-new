// hooks/useGeofences.ts
export const useGeofences = (userId: string | null) => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGeofences = async () => {
    if (!userId) return [];
    setLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINT}?filter[user_id][_eq]=${userId}`);
      if (response.ok) {
        const result = await response.json();
        const validGeofences = (result.data || []).filter(validateGeofenceCoordinates);
        setGeofences(validGeofences);
        return validGeofences;
      }
      throw new Error('Failed to fetch');
    } catch (error) {
      toast.error("Gagal memuat data geofence");
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { geofences, loading, fetchGeofences, setGeofences };
};
