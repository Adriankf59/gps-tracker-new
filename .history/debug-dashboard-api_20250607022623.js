// debug-dashboard-api.js
// Script untuk debug kenapa kendaraan tidak muncul di dashboard

const API_BASE = 'http://localhost:3000';

async function debugDashboardAPI() {
  console.log('🔍 Debugging Dashboard Vehicle Data Issues...');
  console.log('==================================================');
  
  try {
    // 1. Get user data dari sessionStorage simulation
    console.log('\n1️⃣ Testing User Data Retrieval...');
    console.log('Simulating logged in user...');
    
    // Simulate user ID - ganti dengan ID user yang sebenarnya login
    const testUserId = '8d5f1f56-7b31-4007-9082-7d061fdbda9b'; // Ganti dengan user ID real
    console.log('   Using test user ID:', testUserId);
    
    // 2. Test vehicles API
    console.log('\n2️⃣ Testing Vehicles API...');
    const vehiclesUrl = `${API_BASE}/api/vehicles?user_id=${testUserId}&limit=-1`;
    console.log('   Fetching from:', vehiclesUrl);
    
    const vehiclesResponse = await fetch(vehiclesUrl);
    console.log('   Response status:', vehiclesResponse.status);
    
    if (vehiclesResponse.ok) {
      const vehiclesData = await vehiclesResponse.json();
      console.log('   ✅ Vehicles API Success');
      console.log('   📊 Vehicles count:', vehiclesData.data?.length || 0);
      
      if (vehiclesData.data && vehiclesData.data.length > 0) {
        console.log('\n   📋 First Vehicle Structure:');
        const firstVehicle = vehiclesData.data[0];
        console.log('      vehicle_id:', firstVehicle.vehicle_id);
        console.log('      user_id:', firstVehicle.user_id);
        console.log('      gps_id:', firstVehicle.gps_id);
        console.log('      name:', firstVehicle.name);
        console.log('      license_plate:', firstVehicle.license_plate);
        console.log('      make:', firstVehicle.make);
        console.log('      model:', firstVehicle.model);
        
        // Extract GPS IDs
        const gpsIds = vehiclesData.data
          .map(v => v.gps_id)
          .filter(id => id?.trim())
          .join(',');
        
        console.log('\n   🔑 Extracted GPS IDs:', gpsIds);
        console.log('   📊 GPS IDs count:', gpsIds.split(',').length);
        
        // 3. Test vehicle-data API
        console.log('\n3️⃣ Testing Vehicle Data API...');
        const vehicleDataUrl = `${API_BASE}/api/vehicle-data?gps_ids=${gpsIds}&limit=1000`;
        console.log('   Fetching from:', vehicleDataUrl);
        
        const vehicleDataResponse = await fetch(vehicleDataUrl);
        console.log('   Response status:', vehicleDataResponse.status);
        
        if (vehicleDataResponse.ok) {
          const vehicleDataData = await vehicleDataResponse.json();
          console.log('   ✅ Vehicle Data API Success');
          console.log('   📊 Vehicle data count:', vehicleDataData.data?.length || 0);
          
          if (vehicleDataData.data && vehicleDataData.data.length > 0) {
            console.log('\n   📋 First Vehicle Data Structure:');
            const firstData = vehicleDataData.data[0];
            console.log('      vehicle_datas_id:', firstData.vehicle_datas_id);
            console.log('      gps_id:', firstData.gps_id);
            console.log('      vehicle_id:', firstData.vehicle_id);
            console.log('      timestamp:', firstData.timestamp);
            console.log('      latitude:', firstData.latitude);
            console.log('      longitude:', firstData.longitude);
            console.log('      speed:', firstData.speed);
            console.log('      fuel_level:', firstData.fuel_level);
            console.log('      ignition_status:', firstData.ignition_status);
            console.log('      battery_level:', firstData.battery_level);
            
            // 4. Analyze coordinate validity
            console.log('\n4️⃣ Analyzing Coordinate Validity...');
            let validCoordinates = 0;
            let invalidCoordinates = 0;
            
            vehicleDataData.data.forEach((data, index) => {
              const lat = parseFloat(data.latitude);
              const lng = parseFloat(data.longitude);
              
              if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                validCoordinates++;
                if (index < 3) { // Show first 3 valid coordinates
                  console.log(`      Valid coord ${index + 1}: [${lat}, ${lng}]`);
                }
              } else {
                invalidCoordinates++;
                if (index < 3) { // Show first 3 invalid coordinates
                  console.log(`      Invalid coord ${index + 1}: [${data.latitude}, ${data.longitude}]`);
                }
              }
            });
            
            console.log(`   ✅ Valid coordinates: ${validCoordinates}`);
            console.log(`   ❌ Invalid coordinates: ${invalidCoordinates}`);
            
            // 5. Test GPS ID matching
            console.log('\n5️⃣ Testing GPS ID Matching...');
            const vehicleGpsIds = vehiclesData.data.map(v => v.gps_id);
            const dataGpsIds = [...new Set(vehicleDataData.data.map(d => d.gps_id))];
            
            console.log('   Vehicle GPS IDs:', vehicleGpsIds);
            console.log('   Data GPS IDs:', dataGpsIds);
            
            const matchingIds = vehicleGpsIds.filter(id => dataGpsIds.includes(id));
            const missingIds = vehicleGpsIds.filter(id => !dataGpsIds.includes(id));
            
            console.log(`   ✅ Matching GPS IDs: ${matchingIds.length}`, matchingIds);
            console.log(`   ❌ Missing GPS IDs: ${missingIds.length}`, missingIds);
            
            // 6. Simulate processed vehicles creation
            console.log('\n6️⃣ Simulating Processed Vehicles...');
            let validVehiclesForMap = 0;
            
            vehiclesData.data.forEach(vehicle => {
              const vehicleData = vehicleDataData.data
                .filter(data => data.gps_id === vehicle.gps_id)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
              
              if (vehicleData) {
                const lat = parseFloat(vehicleData.latitude);
                const lng = parseFloat(vehicleData.longitude);
                
                if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                  validVehiclesForMap++;
                  console.log(`   ✅ ${vehicle.name}: [${lat}, ${lng}] - Valid for map`);
                } else {
                  console.log(`   ❌ ${vehicle.name}: [${vehicleData.latitude}, ${vehicleData.longitude}] - Invalid coordinates`);
                }
              } else {
                console.log(`   ❌ ${vehicle.name}: No data found for GPS ID ${vehicle.gps_id}`);
              }
            });
            
            console.log(`\n   📍 Vehicles valid for map: ${validVehiclesForMap}/${vehiclesData.data.length}`);
            
          } else {
            console.log('   ❌ No vehicle data received');
          }
        } else {
          const errorText = await vehicleDataResponse.text();
          console.log('   ❌ Vehicle Data API Failed:', errorText);
        }
        
      } else {
        console.log('   ❌ No vehicles found for user');
      }
    } else {
      const errorText = await vehiclesResponse.text();
      console.log('   ❌ Vehicles API Failed:', errorText);
    }
    
    // 7. Test direct Directus endpoints
    console.log('\n7️⃣ Testing Direct Directus Endpoints...');
    console.log('   Testing vehicles endpoint...');
    
    const directVehiclesUrl = `http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle?filter[user_id][_eq]=${testUserId}`;
    try {
      const directVehiclesResponse = await fetch(directVehiclesUrl);
      if (directVehiclesResponse.ok) {
        const directVehiclesData = await directVehiclesResponse.json();
        console.log('   ✅ Direct vehicles API Success');
        console.log('   📊 Direct vehicles count:', directVehiclesData.data?.length || 0);
      } else {
        console.log('   ❌ Direct vehicles API Failed:', directVehiclesResponse.status);
      }
    } catch (error) {
      console.log('   ❌ Direct vehicles API Error:', error.message);
    }
    
    console.log('\n   Testing vehicle_datas endpoint...');
    const directDataUrl = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas?limit=10';
    try {
      const directDataResponse = await fetch(directDataUrl);
      if (directDataResponse.ok) {
        const directDataData = await directDataResponse.json();
        console.log('   ✅ Direct vehicle_datas API Success');
        console.log('   📊 Direct vehicle_datas count:', directDataData.data?.length || 0);
      } else {
        console.log('   ❌ Direct vehicle_datas API Failed:', directDataResponse.status);
      }
    } catch (error) {
      console.log('   ❌ Direct vehicle_datas API Error:', error.message);
    }
    
  } catch (error) {
    console.error('\n💥 Debug Error:', error.message);
  }
  
  // 8. Summary dan rekomendasi
  console.log('\n🎯 DEBUGGING SUMMARY & RECOMMENDATIONS:');
  console.log('=============================================');
  console.log('1. Check if user ID exists and has vehicles');
  console.log('2. Verify GPS IDs are properly set in vehicles');
  console.log('3. Ensure vehicle_datas table has data for those GPS IDs');
  console.log('4. Check coordinate validity (not null, not 0, not NaN)');
  console.log('5. Verify API endpoints are responding correctly');
  console.log('6. Check browser console for JavaScript errors');
  console.log('7. Verify MapComponent is properly receiving vehicle data');
  
  console.log('\nRun this script and share the output to identify the exact issue!');
}

// Check Node.js version
if (typeof fetch === 'undefined') {
  console.log('⚠️  This script requires Node.js 18+ or install node-fetch');
  process.exit(1);
}

// Run debug
debugDashboardAPI();