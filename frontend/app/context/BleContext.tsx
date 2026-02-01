import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import * as BLEAdvertiser from 'react-native-ble-advertiser';

// A specific UUID for our Attendance Tracker App
export const ATTENDANCE_SERVICE_UUID = '0000180D-0000-1000-8000-00805F9B34FB'; 

interface BleContextType {
  manager: BleManager;
  isScanning: boolean;
  startScanning: () => Promise<void>;
  stopScanning: () => void;
  devices: Device[];
  startAdvertising: (userId: string) => Promise<void>;
  stopAdvertising: () => Promise<void>;
}

const BleContext = createContext<BleContextType | null>(null);

// Create a singleton manager outside the component
const bleManager = new BleManager();

export const useBle = () => {
  const context = useContext(BleContext);
  if (!context) {
    throw new Error('useBle must be used within a BleProvider');
  }
  return context;
};

// Helper: Convert Hex String (ObjectId) to Byte Array
const hexStringToByteArray = (hexString: string): number[] => {
  const bytes = [];
  for (let i = 0; i < hexString.length; i += 2) {
    bytes.push(parseInt(hexString.substr(i, 2), 16));
  }
  return bytes;
};

// Robust Base64 to Hex for React Native (Hermes compatible)
const base64ToHexString = (base64: string): string => {
  try {
    const binaryString = atob(base64);
    let hex = "";
    for (let i = 0; i < binaryString.length; i++) {
      const charCode = binaryString.charCodeAt(i).toString(16);
      hex += (charCode.length === 1 ? "0" + charCode : charCode);
    }
    return hex;
  } catch (e) {
    return "";
  }
};

export const BleProvider = ({ children }: { children: React.ReactNode }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);

  // Request Permissions (Android)
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ]);
        return (
          granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_ADVERTISE'] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn("Permission request error:", err);
        return false;
      }
    }
    return true;
  };

  const startScanning = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) {
      console.warn('Bluetooth permissions not granted');
      return;
    }

    try {
        const state = await bleManager.state();
        if (state !== State.PoweredOn) {
          console.warn('Bluetooth is not powered on. Current state:', state);
          return;
        }
    } catch (e) {
        console.error("Error checking bluetooth state:", e);
        return;
    }

    if (!isScanning) {
      setDevices([]);
      setIsScanning(true);
      
      console.log("Starting BLE Scan for UUID:", ATTENDANCE_SERVICE_UUID);
      
      // Delay slightly to ensure adapter is ready
      setTimeout(() => {
        try {
          bleManager.startDeviceScan([ATTENDANCE_SERVICE_UUID], null, (error, device) => {
            if (error) {
              if (error.code === 2) return; // Scan cancelled
              console.error("Scan error details:", JSON.stringify(error));
              setIsScanning(false);
              return;
            }
            
            if (device) {
                 let detectedUserId = null;
                 if (device.manufacturerData) {
                     const hexData = base64ToHexString(device.manufacturerData);
                     if (hexData.length >= 24) {
                        detectedUserId = hexData.slice(-24);
                     }
                 }

                 if (detectedUserId) {
                     device.name = detectedUserId;
                 }

                 if (device.name) {
                    setDevices((prev) => {
                        const index = prev.findIndex((d) => d.id === device.id);
                        if (index !== -1) {
                            if (!prev[index].name && device.name) {
                                const newDevices = [...prev];
                                newDevices[index] = device;
                                return newDevices;
                            }
                            return prev;
                        }
                        return [...prev, device];
                    });
                 }
            }
          });
        } catch (e) {
          console.error("Failed to start device scan:", e);
          setIsScanning(false);
        }
      }, 500);
    }
  };

  const stopScanning = () => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
    console.log("Scanning stopped");
  };

  const startAdvertising = async (userId: string) => {
     if (!userId) return;
     const hasPermissions = await requestPermissions();
     if (!hasPermissions) return;

     try {
       console.log("Starting advertising for UserID:", userId);
       await BLEAdvertiser.setCompanyId(0x00E0); 
       
       const manufData = hexStringToByteArray(userId);
       
       await BLEAdvertiser.broadcast(ATTENDANCE_SERVICE_UUID, manufData, {
         advertiseMode: (BLEAdvertiser as any).ADVERTISE_MODE_BALANCED,
         txPowerLevel: (BLEAdvertiser as any).ADVERTISE_TX_POWER_MEDIUM,
         connectable: false, 
         includeDeviceName: false,
         includeTxPowerLevel: false 
       });
       
       console.log("Advertising started with payload:", userId);
     } catch (error) {
       console.error("Advertising error", error);
     }
  };

  const stopAdvertising = async () => {
    try {
      await BLEAdvertiser.stopBroadcast();
      console.log("Advertising stopped successfully");
    } catch (error) {
       console.error("Stop advertising error", error);
    }
  };

  useEffect(() => {
    const subscription = bleManager.onStateChange((state) => {
      console.log("Bluetooth state changed to:", state);
    }, true);
    return () => {
      subscription.remove();
    };
  }, []);

  const value = useMemo(() => ({
    manager: bleManager,
    isScanning,
    startScanning,
    stopScanning,
    devices,
    startAdvertising,
    stopAdvertising
  }), [isScanning, devices]);

  return (
    <BleContext.Provider value={value}>
      {children}
    </BleContext.Provider>
  );
};