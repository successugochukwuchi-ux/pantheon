import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Smartphone, Search, Trash2, ShieldAlert } from 'lucide-react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';

export default function AdminDevices() {
  const [emailOrStudentId, setEmailOrStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [userDoc, setUserDoc] = useState<any>(null);
  const [confirmingDeviceId, setConfirmingDeviceId] = useState<string | null>(null);

  const searchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrStudentId.trim()) return;
    
    setLoading(true);
    setUserDoc(null);
    setConfirmingDeviceId(null);
    try {
      let q = query(collection(db, 'users'), where('email', '==', emailOrStudentId.trim()));
      let snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        q = query(collection(db, 'users'), where('studentId', '==', emailOrStudentId.trim()));
        snapshot = await getDocs(q);
      }
      
      if (snapshot.empty) {
        toast.error("User not found");
      } else {
        const docSnap = snapshot.docs[0];
        setUserDoc({ id: docSnap.id, ...docSnap.data() });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to search user");
    } finally {
      setLoading(false);
    }
  };

  const removeDevice = async (deviceId: string) => {
    if (!userDoc || !userDoc.devices) return;
    
    setLoading(true);
    try {
      const updatedDevices = userDoc.devices.filter((d: any) => d.id !== deviceId);
      await updateDoc(doc(db, 'users', userDoc.id), {
        devices: updatedDevices
      });
      setUserDoc({ ...userDoc, devices: updatedDevices });
      toast.success("Device disconnected successfully");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userDoc.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Device Management
          </CardTitle>
          <CardDescription>
            Forcefully disconnect devices from a user's account in case of loss or theft. 
            Users are limited to 2 devices per semester.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={searchUser} className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>Search by Email or Student ID</Label>
              <Input 
                value={emailOrStudentId}
                onChange={(e) => setEmailOrStudentId(e.target.value)}
                placeholder="student@example.com or 202011..." 
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-5">
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
          </form>

          {userDoc && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <h3 className="font-semibold text-lg">{userDoc.name || userDoc.username || 'Unknown User'}</h3>
                <p className="text-sm text-muted-foreground">{userDoc.email} • {userDoc.studentId}</p>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium">Active Devices ({userDoc.devices?.length || 0})</h4>
                
                {!userDoc.devices || userDoc.devices.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg text-center">
                    No devices currently registered for this account.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {userDoc.devices.map((device: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 text-primary rounded-md">
                            <Smartphone className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Device {idx + 1} ({device.os || 'Unknown'})</p>
                            <p className="text-xs text-muted-foreground">
                              Semester: {device.semester} • Added: {new Date(device.addedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {confirmingDeviceId === device.id ? (
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => {
                                removeDevice(device.id);
                                setConfirmingDeviceId(null);
                              }}
                              disabled={loading}
                            >
                              Confirm
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setConfirmingDeviceId(null)}
                              disabled={loading}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => setConfirmingDeviceId(device.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Disconnect
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
