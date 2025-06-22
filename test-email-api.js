// test-email-api.js
const testEmailAPI = async () => {
  try {
    console.log('Testing email API...');
    
    const response = await fetch('http://localhost:3000/api/send-geofence-alert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'adriancuman@gmail.com',
        vehicleName: 'Test Vehicle',
        licensePlate: 'TEST 123',
        geofenceName: 'Test Geofence',
        violationType: 'violation_enter',
        location: '-6.8920, 107.6949',
        timestamp: new Date().toISOString(),
        userName: 'Test User'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Email sent successfully!');
    } else {
      console.log('❌ Failed to send email');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Run test
testEmailAPI();