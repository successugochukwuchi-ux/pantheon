import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { Trash2, Phone, User, Check, AlertTriangle, ToggleLeft, ToggleRight, School, Plus, Pencil, Save, X } from 'lucide-react';
import { CredentialSet } from '../services/credentialService';

export default function AdminCredentials() {
  const { profile } = useAuth();
  
  // Credentials states
  const [credentials, setCredentials] = useState<CredentialSet[]>([]);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);

  // University departments states
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDept, setNewDept] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [uniLoading, setUniLoading] = useState(false);

  const universityId = profile?.At || 'futo';

  const fetchCredentials = async () => {
    try {
      const q = query(collection(db, 'credentialSets'), where('At', '==', universityId));
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CredentialSet));
      setCredentials(items);

      // Auto-seed default credentials if none exist
      if (snap.empty) {
        const defaultSet: CredentialSet = {
          name: 'Main Support Line',
          whatsapp: '2348118429150',
          enabled: true,
          At: universityId
        };
        const ref = await addDoc(collection(db, 'credentialSets'), defaultSet);
        setCredentials([{ id: ref.id, ...defaultSet }]);
      }
    } catch (err) {
      console.error("Error fetching credentials:", err);
      toast.error("Failed to load support credentials");
    }
  };

  const fetchUniversityDepartments = async () => {
    try {
      const uniRef = doc(db, 'universities', universityId);
      const snap = await getDoc(uniRef);
      if (snap.exists()) {
        const data = snap.data();
        setDepartments(data.departments || []);
      } else {
        // Fallback or auto-create if missing
        const defaultDeps = [
          'Computer Science',
          'Information Technology',
          'Software Engineering',
          'Cybersecurity',
          'Mechanical Engineering',
          'Electrical Engineering'
        ];
        await setDoc(uniRef, {
          name: universityId === 'futo' ? 'Federal University of Technology, Owerri' : universityId.toUpperCase() + ' University',
          shortName: universityId.toUpperCase(),
          departments: defaultDeps
        });
        setDepartments(defaultDeps);
      }
    } catch (err) {
      console.error("Error loading departments:", err);
    }
  };

  useEffect(() => {
    fetchCredentials();
    fetchUniversityDepartments();
  }, [universityId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) {
      toast.error("Please fill in both name and WhatsApp phone number.");
      return;
    }
    setLoading(true);
    try {
      const newSet: CredentialSet = {
        name: name.trim(),
        whatsapp: whatsapp.trim().replace(/\D/g, ''), // Strip non-digits
        enabled: true, // Enabled by default
        At: universityId
      };
      await addDoc(collection(db, 'credentialSets'), newSet);
      toast.success("Credential set created successfully!");
      setName('');
      setWhatsapp('');
      fetchCredentials();
    } catch (err) {
      console.error("Failed to create credential set:", err);
      toast.error("Failed to save credentials");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (item: CredentialSet) => {
    if (!item.id) return;
    
    // Check if trying to disable the last enabled one
    if (item.enabled) {
      const enabledCount = credentials.filter(c => c.enabled).length;
      if (enabledCount <= 1) {
        toast.error("There must always be at least one enabled credential set!");
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'credentialSets', item.id), {
        enabled: !item.enabled
      });
      toast.success(`Credential set ${!item.enabled ? 'enabled' : 'disabled'}`);
      fetchCredentials();
    } catch (err) {
      console.error("Failed to toggle credential status:", err);
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    const item = credentials.find(c => c.id === id);
    if (item?.enabled) {
      const enabledCount = credentials.filter(c => c.enabled).length;
      if (enabledCount <= 1) {
        toast.error("You cannot delete the only enabled credential set! Enable another set first.");
        return;
      }
    }

    try {
      await deleteDoc(doc(db, 'credentialSets', id));
      toast.success("Credential set deleted");
      fetchCredentials();
    } catch (err) {
      console.error("Failed to delete credential set:", err);
      toast.error("Failed to delete");
    }
  };

  // --- Department Actions ---
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.trim()) return;

    if (departments.some(d => d.toLowerCase() === newDept.trim().toLowerCase())) {
      toast.error("Department already exists!");
      return;
    }

    setUniLoading(true);
    try {
      const updated = [...departments, newDept.trim()];
      await updateDoc(doc(db, 'universities', universityId), {
        departments: updated
      });
      setDepartments(updated);
      setNewDept('');
      toast.success("Department added successfully!");
    } catch (err) {
      console.error("Failed to add department:", err);
      toast.error("Failed to add department");
    } finally {
      setUniLoading(false);
    }
  };

  const startEditDepartment = (index: number, val: string) => {
    setEditIndex(index);
    setEditValue(val);
  };

  const handleSaveEditDepartment = async (index: number) => {
    if (!editValue.trim()) return;

    const updated = [...departments];
    updated[index] = editValue.trim();

    setUniLoading(true);
    try {
      await updateDoc(doc(db, 'universities', universityId), {
        departments: updated
      });
      setDepartments(updated);
      setEditIndex(null);
      toast.success("Department updated successfully!");
    } catch (err) {
      console.error("Failed to update department:", err);
      toast.error("Failed to update department");
    } finally {
      setUniLoading(false);
    }
  };

  const handleDeleteDepartment = async (index: number) => {
    const deptToDelete = departments[index];
    const updated = departments.filter((_, i) => i !== index);

    setUniLoading(true);
    try {
      await updateDoc(doc(db, 'universities', universityId), {
        departments: updated
      });
      setDepartments(updated);
      toast.success(`Department "${deptToDelete}" deleted`);
    } catch (err) {
      console.error("Failed to delete department:", err);
      toast.error("Failed to delete department");
    } finally {
      setUniLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Support Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Support Contact Settings
          </CardTitle>
          <CardDescription>
            Configure WhatsApp support credentials for users of your university (<strong>{universityId.toUpperCase()}</strong>).
            If multiple credentials are enabled, the platform will choose one at random to distribute support requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adminName">Admin Name / Identifier</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="adminName"
                    placeholder="e.g. Admin Chidi" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminWhatsapp">WhatsApp Number (with Country Code)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="adminWhatsapp"
                    placeholder="e.g. 2348118429150" 
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    required
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              {loading ? 'Saving...' : 'Add Credential Set'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 2. Active Credentials */}
      <Card>
        <CardHeader>
          <CardTitle>Active Credentials</CardTitle>
          <CardDescription>Below are all the support lines configured for your university.</CardDescription>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">No credentials set up yet.</div>
          ) : (
            <div className="space-y-4">
              {credentials.map((item) => (
                <div 
                  key={item.id} 
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    item.enabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/40 border-muted'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{item.name}</span>
                      {item.enabled ? (
                        <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <Check className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> +{item.whatsapp}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleStatus(item)}
                      title={item.enabled ? "Disable Set" : "Enable Set"}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {item.enabled ? (
                        <ToggleRight className="h-8 w-8 text-primary" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                      )}
                    </button>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(item.id)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Delete Credential"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Manage University Departments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5 text-primary" />
            University Departments Manager
          </CardTitle>
          <CardDescription>
            View, create, and edit the academic departments for <strong>{universityId.toUpperCase()}</strong>.
            All additions and modifications are instantly available to students during signup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddDepartment} className="flex gap-2">
            <Input 
              placeholder="e.g. Biomedical Engineering"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              required
            />
            <Button type="submit" disabled={uniLoading}>
              <Plus className="h-4 w-4 mr-1" /> Add Department
            </Button>
          </form>

          <div className="space-y-2">
            <h4 className="font-bold text-sm text-muted-foreground">Registered Departments ({departments.length})</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {departments.map((dept, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  {editIndex === index ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <Input 
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 py-0"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleSaveEditDepartment(index)}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setEditIndex(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium">{dept}</span>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => startEditDepartment(index, dept)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteDepartment(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
