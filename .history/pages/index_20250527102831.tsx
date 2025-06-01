import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Shield, Smartphone, BarChart3 } from "lucide-react";
import Link from "next/link";

const LandingPage = () => {
  const features = [
    {
      icon: MapPin,
      title: "Real-time Tracking",
      description: "Monitor your vehicles in real-time with precise GPS location data"
    },
    {
      icon: Shield,
      title: "Geofence Protection",
      description: "Set up virtual boundaries and get alerts when vehicles enter or exit zones"
    },
    {
      icon: Smartphone,
      title: "Remote Control",
      description: "Control vehicle functions remotely including engine on/off commands"
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Comprehensive reports on vehicle usage, fuel consumption, and performance"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">GPS Tracker</h1>
                <p className="text-sm text-slate-500">Vehicle Management System</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/login" passHref>
                <Button variant="outline">Masuk</Button>
              </Link>
              <Link href="/register" passHref>
                <Button>Daftar</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-slate-800 mb-6">
            Pantau Kendaraan Anda
            <span className="block text-blue-600">Dengan Mudah</span>
          </h2>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            Sistem manajemen kendaraan terdepan dengan teknologi GPS real-time, 
            geofencing, dan kontrol jarak jauh untuk keamanan maksimal.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" passHref>
              <Button size="lg" className="text-lg px-8 py-3">Mulai Gratis</Button>
            </Link>
            <Link href="/login" passHref>
              <Button variant="outline" size="lg" className="text-lg px-8 py-3">Sudah Punya Akun?</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-800 mb-4">
              Fitur Unggulan
            </h3>
            <p className="text-lg text-slate-600">
              Kelola armada kendaraan Anda dengan teknologi terdepan
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Siap Memulai?
          </h3>
          <p className="text-xl text-blue-100 mb-8">
            Bergabunglah dengan ribuan pengguna yang telah mempercayai sistem kami
          </p>
          <Link href="/register" passHref>
            <Button size="lg" variant="secondary" className="text-lg px-8 py-3">Daftar Sekarang</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">GPS Tracker</span>
          </div>
          <p className="text-slate-400">
            © 2024 GPS Tracker. Semua hak dilindungi.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;