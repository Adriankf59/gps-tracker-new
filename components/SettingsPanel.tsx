"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Settings as SettingsIcon, 
  Bell, 
  MapPin, 
  Shield,
  Database,
  Smartphone,
  Mail,
  Save
} from "lucide-react";

interface SettingsPanelProps {}

export function SettingsPanel({}: SettingsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">System Settings</h1>
          <p className="text-slate-600">Configure system preferences and parameters</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700">
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-blue-600" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input id="company-name" defaultValue="PT. Fleet Management" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select defaultValue="asia-jakarta">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asia-jakarta">Asia/Jakarta (WIB)</SelectItem>
                  <SelectItem value="asia-makassar">Asia/Makassar (WITA)</SelectItem>
                  <SelectItem value="asia-jayapura">Asia/Jayapura (WIT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select defaultValue="id">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date-format">Date Format</Label>
              <Select defaultValue="dd-mm-yyyy">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dd-mm-yyyy">DD/MM/YYYY</SelectItem>
                  <SelectItem value="mm-dd-yyyy">MM/DD/YYYY</SelectItem>
                  <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        {/* Tracking Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              Tracking Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="update-interval">Update Interval (seconds)</Label>
              <Input id="update-interval" type="number" defaultValue="30" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="speed-limit">Default Speed Limit (km/h)</Label>
              <Input id="speed-limit" type="number" defaultValue="80" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="idle-timeout">Idle Timeout (minutes)</Label>
              <Input id="idle-timeout" type="number" defaultValue="5" />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-geofence">Auto Geofence Creation</Label>
                <p className="text-sm text-slate-500">Automatically create geofences for frequent stops</p>
              </div>
              <Switch id="auto-geofence" />
            </div>
          </CardContent>
        </Card>
        {/* Alert Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-600" />
              Alert Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="speed-alerts">Speed Limit Alerts</Label>
                <p className="text-sm text-slate-500">Alert when vehicles exceed speed limit</p>
              </div>
              <Switch id="speed-alerts" defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="geofence-alerts">Geofence Alerts</Label>
                <p className="text-sm text-slate-500">Alert on geofence enter/exit events</p>
              </div>
              <Switch id="geofence-alerts" defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="fuel-alerts">Low Fuel Alerts</Label>
                <p className="text-sm text-slate-500">Alert when fuel level is low</p>
              </div>
              <Switch id="fuel-alerts" defaultChecked />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fuel-threshold">Fuel Alert Threshold (%)</Label>
              <Input id="fuel-threshold" type="number" defaultValue="20" />
            </div>
          </CardContent>
        </Card>
        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
              <Input id="session-timeout" type="number" defaultValue="60" />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                <p className="text-sm text-slate-500">Require 2FA for all users</p>
              </div>
              <Switch id="two-factor" />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="audit-log">Audit Logging</Label>
                <p className="text-sm text-slate-500">Log all user actions</p>
              </div>
              <Switch id="audit-log" defaultChecked />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password-policy">Password Policy</Label>
              <Select defaultValue="medium">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basic (6+ characters)</SelectItem>
                  <SelectItem value="medium">Medium (8+ chars, mixed case)</SelectItem>
                  <SelectItem value="high">Strong (12+ chars, symbols)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        {/* Communication Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              Communication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sms-provider">SMS Provider</Label>
              <Select defaultValue="local">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local Provider</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="nexmo">Nexmo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="smtp-server">SMTP Server</Label>
              <Input id="smtp-server" defaultValue="smtp.company.com" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input id="smtp-port" type="number" defaultValue="587" />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <p className="text-sm text-slate-500">Send alerts via email</p>
              </div>
              <Switch id="email-notifications" defaultChecked />
            </div>
          </CardContent>
        </Card>
        {/* Data Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-green-600" />
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="data-retention">Data Retention Period (days)</Label>
              <Input id="data-retention" type="number" defaultValue="365" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="backup-frequency">Backup Frequency</Label>
              <Select defaultValue="daily">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-cleanup">Auto Data Cleanup</Label>
                <p className="text-sm text-slate-500">Automatically delete old data</p>
              </div>
              <Switch id="auto-cleanup" defaultChecked />
            </div>
            
            <Button variant="outline" className="w-full">
              <Database className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}