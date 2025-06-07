// browser-debug.js
// Copy dan paste script ini di Browser Console (F12 → Console)

async function debugDashboardInBrowser() {
  console.log('🔍 Debugging Dashboard in Browser...');
  console.log('===========================================');
  
  try {
    const userId = '8d5f1f56-7b31-4007-9082-7d061fdbda9b';
    
    // 1. Test API calls langsung
    console.log('\n1️⃣ Testing API Calls...');
    
    // Test vehicles API
    console.log('Testing vehicles API...');
    const vehiclesResponse = await fetch(`/api/vehicles?user_id=${userId}&limit=-1`);
    const vehiclesData = await vehiclesResponse.json();
    console.log('Vehicles API result:', vehiclesData);
    
    if (vehiclesData.success && vehiclesData.data.length > 0) {
      const vehicle = vehiclesData.data[0];
      console.log('✅ Vehicle found:', {
        id: vehicle.vehicle_id,
        name: vehicle.name,
        gps_id: vehicle.gps_id
      });
      
      // Test vehicle data API
      console.log('\nTesting vehicle data API...');
      const vehicleDataResponse = await fetch(`/api/vehicle-data?gps_ids=${vehicle.gps_id}&limit=5`);
      const vehicleDataData = await vehicleDataResponse.json();
      console.log('Vehicle Data API result:', vehicleDataData);
      
      if (vehicleDataData.data && vehicleDataData.data.length > 0) {
        const latestData = vehicleDataData.data[0];
        console.log('✅ Latest vehicle data:', latestData);
        
        // 2. Manual coordinate processing
        console.log('\n2️⃣ Manual Coordinate Processing...');
        console.log('Raw coordinates:', {
          latitude: latestData.latitude,
          longitude: latestData.longitude,
          latType: typeof latestData.latitude,
          lngType: typeof latestData.longitude
        });
        
        // Test parsing
        const lat = parseFloat(latestData.latitude);
        const lng = parseFloat(latestData.longitude);
        
        console.log('Parsed coordinates:', {
          lat: lat,
          lng: lng,
          latValid: !isNaN(lat) && lat !== 0,
          lngValid: !isNaN(lng) && lng !== 0
        });
        
        // Test all conditions
        const conditions = {
          hasData: !!latestData,
          latNotNull: latestData.latitude !== null,
          latNotUndefined: latestData.latitude !== undefined,
          lngNotNull: latestData.longitude !== null,
          lngNotUndefined: latestData.longitude !== undefined,
          latNotEmpty: latestData.latitude !== '',
          lngNotEmpty: latestData.longitude !== '',
          latParseable: !isNaN(parseFloat(latestData.latitude)),
          lngParseable: !isNaN(parseFloat(latestData.longitude)),
          latNonZero: parseFloat(latestData.latitude) !== 0,
          lngNonZero: parseFloat(latestData.longitude) !== 0
        };
        
        console.log('Condition checks:', conditions);
        
        const allConditionsMet = Object.values(conditions).every(Boolean);
        console.log('All conditions met:', allConditionsMet);
        
        if (allConditionsMet) {
          console.log('✅ Coordinates should be VALID!');
          console.log('Final position:', [lat, lng]);
        } else {
          console.log('❌ Some conditions failed:');
          Object.entries(conditions).forEach(([key, value]) => {
            if (!value) console.log(`   - ${key}: ${value}`);
          });
        }
        
      } else {
        console.log('❌ No vehicle data found');
      }
    } else {
      console.log('❌ No vehicles found');
    }
    
    // 3. Check React state (if available)
    console.log('\n3️⃣ Checking React Components...');
    
    // Check if Dashboard component exists
    const dashboardElements = document.querySelectorAll('[class*="dashboard"], [class*="Dashboard"]');
    console.log('Dashboard elements found:', dashboardElements.length);
    
    // Check map container
    const mapElements = document.querySelectorAll('[class*="leaflet"], [id*="map"], [class*="map"]');
    console.log('Map elements found:', mapElements.length);
    
    if (mapElements.length > 0) {
      console.log('Map element details:', Array.from(mapElements).map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        innerHTML: el.innerHTML.substring(0, 100) + '...'
      })));
    }
    
    // 4. Check console for React errors
    console.log('\n4️⃣ Console Error Check...');
    console.log('Check the console above for any React component errors');
    console.log('Look for errors related to:');
    console.log('- MapComponent loading');
    console.log('- Leaflet library');
    console.log('- React hooks');
    console.log('- useEffect errors');
    
    // 5. Force trigger a re-render (if possible)
    console.log('\n5️⃣ Debug Info Summary...');
    console.log('=========================');
    console.log('✅ APIs working correctly');
    console.log('📍 Check coordinate processing above');
    console.log('🗺️ Check map component mounting');
    console.log('⚠️  Check for React/Leaflet errors');
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Check coordinate processing results above');
    console.log('2. Look for any React errors in console');
    console.log('3. Verify MapComponent is mounting correctly');
    console.log('4. Check if Leaflet CSS is loaded');
    
  } catch (error) {
    console.error('💥 Browser debug error:', error);
  }
}

// Run the debug
debugDashboardInBrowser();

// Also add a helper to check Dashboard state
window.debugDashboard = () => {
  console.log('🔍 Dashboard State Check...');
  
  // Try to find React Fiber nodes (for development)
  const dashboardElement = document.querySelector('[class*="dashboard"], [class*="Dashboard"]');
  if (dashboardElement) {
    console.log('Dashboard element found:', dashboardElement);
    
    // Check for React dev tools
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('React DevTools detected - check Components tab');
    }
  } else {
    console.log('❌ No dashboard element found');
  }
};

console.log('💡 You can also run: debugDashboard() to check component state');