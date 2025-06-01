import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Map, Shield, Smartphone, Zap, Users, BarChart3 } from 'lucide-react';

const Homepage = () => {
  const features = [
    {
      icon: Map,
      title: 'Real-time Tracking',
      description: 'Monitor lokasi kendaraan Anda secara real-time dengan akurasi tinggi'
    },
    {
      icon: Shield,
      title: 'Geofencing',
      description: 'Buat zona aman dan dapatkan notifikasi ketika kendaraan keluar area'
    },
    {
      icon: Smartphone,
      title: 'Remote Control',
      description: 'Matikan mesin kendaraan dari jarak jauh untuk keamanan maksimal'
    },
    {
      icon: Zap,
      title: 'Real-time Alerts',
      description: 'Notifikasi instan untuk setiap aktivitas mencurigakan'
    },
    {
      icon: Users,
      title: 'Multi-user Access',
      description: 'Kelola akses untuk tim dan family members'
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'Laporan lengkap perjalanan dan analisis pola berkendara'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-green-600"></div>
        <div className="absolute inset-0 bg-black/20"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Map className="w-12 h-12 text-white" />
              </div>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              GPS Tracker
              <span className="block text-2xl md:text-3xl font-normal mt-2 text-blue-100">
                Professional Vehicle Tracking
              </span>
            </h1>
            
            <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto">
              Solusi tracking kendaraan terdepan dengan teknologi GPS real-time, 
              geofencing pintar, dan kontrol jarak jauh untuk keamanan maksimal.
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Fitur Lengkap untuk Keamanan Kendaraan
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Teknologi canggih yang dirancang khusus untuk memberikan perlindungan 
              dan monitoring terbaik untuk kendaraan Anda.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-green-50 hover:shadow-lg transition-all duration-300 group">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-gradient-to-r from-blue-600 to-green-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Siap Mulai Melindungi Kendaraan Anda?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Bergabung dengan ribuan pengguna yang telah mempercayai kami untuk keamanan kendaraan mereka.
          </p>
          <Link href="/register">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-3 text-lg">
              Daftar Sekarang - Gratis
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Homepage;