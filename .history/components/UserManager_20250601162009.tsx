"use client";

import React, { useState } from "react"; // Tambahkan React jika belum ada
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  Shield,
  User,
  Crown
} from "lucide-react";

// Definisikan interface User di sini atau impor dari file terpisah
interface UserProfile { // Mengganti nama User menjadi UserProfile untuk menghindari konflik jika ada tipe User global
  id: number;
  username: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: "admin" | "manager" | "operator" | "viewer";
  status: "active" | "inactive";
  lastLogin: string;
  vehiclesAssigned: number;
}

export function UserManager() {
  const [searchTerm, setSearchTerm] = useState("");

  const users: UserProfile[] = [ // Gunakan interface UserProfile
    {
      id: 1,
      username: "admin",
      fullName: "Ahmad Rahman",
      email: "ahmad.rahman@company.com",
      phoneNumber: "+62 812-3456-7890",
      role: "admin",
      status: "active",
      lastLogin: "2024-01-25 14:30:25",
      vehiclesAssigned: 12
    },
    {
      id: 2,
      username: "manager01",
      fullName: "Siti Nurhaliza",
      email: "siti.nur@company.com",
      phoneNumber: "+62 813-4567-8901",
      role: "manager",
      status: "active",
      lastLogin: "2024-01-25 13:45:12",
      vehiclesAssigned: 8
    },
    {
      id: 3,
      username: "operator01",
      fullName: "Budi Santoso",
      email: "budi.santoso@company.com",
      phoneNumber: "+62 814-5678-9012",
      role: "operator",
      status: "active",
      lastLogin: "2024-01-25 12:15:08",
      vehiclesAssigned: 3
    },
    {
      id: 4,
      username: "viewer01",
      fullName: "Maya Indira",
      email: "maya.indira@company.com",
      phoneNumber: "+62 815-6789-0123",
      role: "viewer",
      status: "inactive",
      lastLogin: "2024-01-20 09:30:15",
      vehiclesAssigned: 0
    },
    {
      id: 5,
      username: "operator02",
      fullName: "Andi Wijaya",
      email: "andi.wijaya@company.com",
      phoneNumber: "+62 816-7890-1234",
      role: "operator",
      status: "active",
      lastLogin: "2024-01-25 11:22:45",
      vehiclesAssigned: 5
    }
  ];

  const filteredUsers = users.filter(user =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: UserProfile['status']) => {
    return status === 'active'
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-red-100 text-red-700 border-red-200';
  };

  const getRoleColor = (role: UserProfile['role']) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'manager':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'operator':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        // Untuk memastikan semua path return string, meski switch sudah mencakup semua case UserProfile['role']
        const exhaustiveCheck: never = role; 
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRoleIcon = (role: UserProfile['role']) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4" />;
      case 'manager':
        return <Shield className="w-4 h-4" />;
      case 'operator':
        return <User className="w-4 h-4" />;
      case 'viewer':
        return <Users className="w-4 h-4" />;
      default:
        const exhaustiveCheck: never = role;
        return <User className="w-4 h-4" />;
    }
  };

  const formatRole = (role: UserProfile['role']) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getInitials = (name: string): string => {
    if (!name || typeof name !== 'string') return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="text-slate-600">Manage system users and their access permissions</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>
      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search users by name, username, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {users.filter(u => u.status === 'active').length}
                </p>
                <p className="text-sm text-slate-600">Active Users</p>
              </div>
              <Users className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {users.filter(u => u.role === 'admin').length}
                </p>
                <p className="text-sm text-slate-600">Administrators</p>
              </div>
              <Crown className="w-6 h-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {users.filter(u => u.role === 'operator').length}
                </p>
                <p className="text-sm text-slate-600">Operators</p>
              </div>
              <User className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {users.reduce((acc, u) => acc + u.vehiclesAssigned, 0)}
                </p>
                <p className="text-sm text-slate-600">Total Assignments</p>
              </div>
              <Shield className="w-6 h-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      {/* User Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                      {getInitials(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{user.fullName}</CardTitle>
                    <p className="text-sm text-slate-500">@{user.username}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2"> {/* Align badges to the right */}
                  <Badge className={`${getStatusColor(user.status)} self-end`}> {/* self-end */}
                    {user.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge className={`${getRoleColor(user.role)} self-end`}> {/* self-end */}
                    <div className="flex items-center gap-1">
                      {getRoleIcon(user.role)}
                      {formatRole(user.role)}
                    </div>
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{user.phoneNumber}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-slate-500">Vehicles Assigned</p>
                  <p className="text-xl font-bold text-blue-600">{user.vehiclesAssigned}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-slate-500">Last Login</p>
                  <p className="text-xs font-medium text-slate-700">{user.lastLogin}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Shield className="w-3 h-3 mr-1" />
                  Permissions
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"> {/* More specific hover for red */}
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {filteredUsers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No users found</h3>
            <p className="text-slate-500">Try adjusting your search criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}