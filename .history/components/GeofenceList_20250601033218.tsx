// components/GeofenceList.tsx
const GeofenceList = ({ 
  geofences, 
  currentGeofence, 
  onSelect, 
  onAssign, 
  onDelete 
}) => {
  return (
    <div className="space-y-2">
      {geofences.map((geofence) => (
        <GeofenceCard
          key={geofence.geofence_id}
          geofence={geofence}
          isSelected={currentGeofence?.geofence_id === geofence.geofence_id}
          onSelect={onSelect}
          onAssign={onAssign}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
