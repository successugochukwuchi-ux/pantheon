import React, { useState, useEffect } from 'react';
import { 
  collection, 
  setDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  getDocs,
  query,
  where,
  deleteDoc,
  increment,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Building, 
  Home, 
  PlusCircle, 
  DollarSign, 
  Settings, 
  AlertCircle, 
  Users, 
  CreditCard,
  Image as ImageIcon,
  Film,
  ToggleLeft,
  ToggleRight,
  Shield,
  HelpCircle
} from 'lucide-react';
import { ColodgeLocation, ColodgeLodge, ColodgeRoom, ColodgeAgentApplication, ColodgeDeal, ColodgeEscrowAccount } from '../types';

export default function AdminColodge() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'applications' | 'deals' | 'escrow' | 'banks' | 'infrastructure'>('applications');
  
  // System Config / Bank State
  const [banks, setBanks] = useState<string[]>([]);
  const [agentsCanAddLodges, setAgentsCanAddLodges] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [newBankName, setNewBankName] = useState('');
  
  // Data States
  const [applications, setApplications] = useState<ColodgeAgentApplication[]>([]);
  const [deals, setDeals] = useState<ColodgeDeal[]>([]);
  const [escrowAccounts, setEscrowAccounts] = useState<ColodgeEscrowAccount[]>([]);
  const [locations, setLocations] = useState<ColodgeLocation[]>([]);
  const [lodges, setLodges] = useState<ColodgeLodge[]>([]);
  const [rooms, setRooms] = useState<ColodgeRoom[]>([]);

  // Form States (Infrastructure)
  const [newLocation, setNewLocation] = useState({ name: '', description: '', galleryInput: '', At: '' });
  const [newLodge, setNewLodge] = useState({ locationId: '', name: '', description: '', galleryInput: '', At: '' });
  const [newRoom, setNewRoom] = useState({ lodgeId: '', name: '', description: '', photoUrl: '', videoUrl: '', price: '' });
  const [newEscrow, setNewEscrow] = useState({ accountNumber: '', bankName: '' });

  // Load Colodge System Settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'colodge'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBanks(data.banks || []);
        setAgentsCanAddLodges(data.agentsCanAddLodges || false);
        setWhatsappNumber(data.whatsappNumber || '');
      } else {
        // Seed default config
        const defaultBanks = [
          "Access Bank", "GTBank", "Zenith Bank", "United Bank for Africa (UBA)", 
          "First Bank of Nigeria", "Kuda Bank", "Opay", "Palmpay", "Sterling Bank", "Wema Bank"
        ];
        setDoc(doc(db, 'system', 'colodge'), {
          banks: defaultBanks,
          agentsCanAddLodges: false,
          whatsappNumber: '+2348000000000'
        }).then(() => {
          setBanks(defaultBanks);
          setWhatsappNumber('+2348000000000');
        });
      }
    });
    return unsub;
  }, []);

  // Real-time Data Listeners
  useEffect(() => {
    const unsubApps = onSnapshot(collection(db, 'colodge_agent_applications'), (snap) => {
      const list: ColodgeAgentApplication[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ColodgeAgentApplication));
      setApplications(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });

    const unsubDeals = onSnapshot(collection(db, 'colodge_deals'), (snap) => {
      const list: ColodgeDeal[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ColodgeDeal));
      setDeals(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });

    const unsubEscrow = onSnapshot(collection(db, 'colodge_escrow_accounts'), (snap) => {
      const list: ColodgeEscrowAccount[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ColodgeEscrowAccount));
      setEscrowAccounts(list);
    });

    const unsubLocs = onSnapshot(collection(db, 'colodge_locations'), (snap) => {
      const list: ColodgeLocation[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ColodgeLocation));
      setLocations(list.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const unsubLodges = onSnapshot(collection(db, 'colodge_lodges'), (snap) => {
      const list: ColodgeLodge[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ColodgeLodge));
      setLodges(list.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const unsubRooms = onSnapshot(collection(db, 'colodge_rooms'), (snap) => {
      const list: ColodgeRoom[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ColodgeRoom));
      setRooms(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });

    return () => {
      unsubApps();
      unsubDeals();
      unsubEscrow();
      unsubLocs();
      unsubLodges();
      unsubRooms();
    };
  }, []);

  // System Config Handlers
  const handleToggleAgentsAdd = async () => {
    try {
      const nextVal = !agentsCanAddLodges;
      await updateDoc(doc(db, 'system', 'colodge'), { agentsCanAddLodges: nextVal });
      toast.success(nextVal ? "Agents are now permitted to add rooms and lodges." : "Agents are blocked from adding rooms/lodges.");
    } catch (e: any) {
      toast.error(e.message || "Failed to update config.");
    }
  };

  const handleUpdateWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'system', 'colodge'), { whatsappNumber });
      toast.success("WhatsApp receipt contact number updated.");
    } catch (e: any) {
      toast.error(e.message || "Failed to update contact number.");
    }
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim()) return;
    if (banks.includes(newBankName.trim())) {
      toast.error("Bank already exists in list.");
      return;
    }
    try {
      const updatedBanks = [...banks, newBankName.trim()].sort();
      await updateDoc(doc(db, 'system', 'colodge'), { banks: updatedBanks });
      setNewBankName('');
      toast.success("Bank added successfully.");
    } catch (e: any) {
      toast.error(e.message || "Failed to add bank.");
    }
  };

  const handleDeleteBank = async (bank: string) => {
    try {
      const updatedBanks = banks.filter(b => b !== bank);
      await updateDoc(doc(db, 'system', 'colodge'), { banks: updatedBanks });
      toast.success("Bank removed successfully.");
    } catch (e: any) {
      toast.error(e.message || "Failed to remove bank.");
    }
  };

  // Agent Application Handlers
  const handleApproveAgent = async (app: ColodgeAgentApplication) => {
    try {
      // 1. Update user profile to be colodge_agent
      await updateDoc(doc(db, 'users', app.uid), {
        colodge_agent: true,
        agentBankAccount: app.bankAccount,
        agentBankName: app.bankName,
        agentGovernmentName: app.governmentName,
        agentTicketCode: app.ticketCode,
        walletBalance: 0,
        agentFee: 0, // initially unset
        agentFeeHistory: []
      });

      // 2. Update application status
      await updateDoc(doc(db, 'colodge_agent_applications', app.id), {
        status: 'approved'
      });

      toast.success(`${app.governmentName} is now an active CoLodge agent!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to approve agent.");
    }
  };

  const handleRejectAgent = async (app: ColodgeAgentApplication) => {
    try {
      await updateDoc(doc(db, 'colodge_agent_applications', app.id), {
        status: 'rejected'
      });
      toast.success(`Application of ${app.governmentName} has been rejected.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to reject application.");
    }
  };

  // Escrow Handlers
  const handleAddEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEscrow.accountNumber || !newEscrow.bankName) {
      toast.error("Please fill all escrow fields.");
      return;
    }
    try {
      const newId = `escrow_${Date.now()}`;
      await setDoc(doc(db, 'colodge_escrow_accounts', newId), {
        id: newId,
        accountNumber: newEscrow.accountNumber,
        bankName: newEscrow.bankName,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      setNewEscrow({ accountNumber: '', bankName: '' });
      toast.success("New Escrow account added.");
    } catch (e: any) {
      toast.error(e.message || "Failed to add escrow account.");
    }
  };

  const handleToggleEscrow = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'colodge_escrow_accounts', id), { isActive: !current });
      toast.success("Escrow account status updated.");
    } catch (e: any) {
      toast.error(e.message || "Failed to update escrow status.");
    }
  };

  const handleDeleteEscrow = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'colodge_escrow_accounts', id));
      toast.success("Escrow account deleted.");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete escrow account.");
    }
  };

  // Infrastructure Creators (Locations, Lodges, Rooms)
  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.name || !newLocation.description || !newLocation.At) {
      toast.error("Please fill in name, description, and university code (At).");
      return;
    }
    try {
      const gallery = newLocation.galleryInput
        ? newLocation.galleryInput.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const newId = `loc_${Date.now()}`;
      await setDoc(doc(db, 'colodge_locations', newId), {
        id: newId,
        name: newLocation.name,
        description: newLocation.description,
        gallery,
        At: newLocation.At.toUpperCase().trim(),
        createdAt: new Date().toISOString()
      });
      setNewLocation({ name: '', description: '', galleryInput: '', At: '' });
      toast.success("CoLodge Location created!");
    } catch (e: any) {
      toast.error(e.message || "Failed to create location.");
    }
  };

  const handleCreateLodge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLodge.locationId || !newLodge.name || !newLodge.description || !newLodge.At) {
      toast.error("Please fill all required lodge fields.");
      return;
    }
    try {
      const gallery = newLodge.galleryInput
        ? newLodge.galleryInput.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const newId = `lodge_${Date.now()}`;
      await setDoc(doc(db, 'colodge_lodges', newId), {
        id: newId,
        locationId: newLodge.locationId,
        name: newLodge.name,
        description: newLodge.description,
        gallery,
        At: newLodge.At.toUpperCase().trim(),
        createdAt: new Date().toISOString()
      });
      setNewLodge({ locationId: '', name: '', description: '', galleryInput: '', At: '' });
      toast.success("CoLodge Lodge created!");
    } catch (e: any) {
      toast.error(e.message || "Failed to create lodge.");
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.lodgeId || !newRoom.name || !newRoom.description || !newRoom.price) {
      toast.error("Please fill all required room fields.");
      return;
    }
    try {
      const newId = `room_${Date.now()}`;
      await setDoc(doc(db, 'colodge_rooms', newId), {
        id: newId,
        lodgeId: newRoom.lodgeId,
        name: newRoom.name,
        description: newRoom.description,
        photoUrl: newRoom.photoUrl.trim() || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
        videoUrl: newRoom.videoUrl.trim() || '',
        price: Number(newRoom.price),
        status: 'available',
        createdAt: new Date().toISOString()
      });
      setNewRoom({ lodgeId: '', name: '', description: '', photoUrl: '', videoUrl: '', price: '' });
      toast.success("CoLodge Room created and listed!");
    } catch (e: any) {
      toast.error(e.message || "Failed to create room.");
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this location? All lodges in this location will be orphaned.")) return;
    try {
      await deleteDoc(doc(db, 'colodge_locations', id));
      toast.success("Location deleted.");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete.");
    }
  };

  const handleDeleteLodge = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this lodge? Rooms in this lodge will be orphaned.")) return;
    try {
      await deleteDoc(doc(db, 'colodge_lodges', id));
      toast.success("Lodge deleted.");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete.");
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this room?")) return;
    try {
      await deleteDoc(doc(db, 'colodge_rooms', id));
      toast.success("Room deleted.");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete.");
    }
  };

  // Deal / Payments / Dispute Handlers
  const handleVerifyPayment = async (deal: ColodgeDeal) => {
    try {
      await updateDoc(doc(db, 'colodge_deals', deal.id), {
        status: 'payment_confirmed',
        paymentConfirmedAt: new Date().toISOString()
      });
      toast.success("Payment verified! Student can now confirm lodging.");
    } catch (e: any) {
      toast.error(e.message || "Failed to verify payment.");
    }
  };

  const handleResolveDisputeRefund = async (deal: ColodgeDeal) => {
    if (!window.confirm("Are you sure you want to REFUND the student? This cancels the deal, returns the room to available, and gives no payout to the agent.")) return;
    try {
      // 1. Mark deal refunded
      await updateDoc(doc(db, 'colodge_deals', deal.id), {
        status: 'cancelled_refunded',
        resolvedAt: new Date().toISOString(),
        resolvedBy: profile?.email || 'Admin'
      });

      // 2. Free up the room
      await updateDoc(doc(db, 'colodge_rooms', deal.roomId), {
        status: 'available',
        inTalksWith: null
      });

      toast.success("Dispute resolved: Student refunded off-app. Room is available.");
    } catch (e: any) {
      toast.error(e.message || "Failed to resolve.");
    }
  };

  const handleResolveDisputeToAgent = async (deal: ColodgeDeal) => {
    if (!window.confirm("Are you sure you want to release funds to the AGENT? 90% of the agent fee will be added to the agent's balance, 10% to Colearn revenue, and the room will be marked rented.")) return;
    try {
      const totalFee = deal.agentFeePaid;
      const agentShare = totalFee * 0.9;
      const colearnShare = totalFee * 0.1;

      // 1. Add share to agent's walletBalance
      await updateDoc(doc(db, 'users', deal.agentId), {
        walletBalance: increment(agentShare)
      });

      // 2. Store Colearn Revenue report item
      await addDoc(collection(db, 'colearn_revenue_reports'), {
        dealId: deal.id,
        roomId: deal.roomId,
        agentId: deal.agentId,
        agentName: deal.agentName,
        totalAgentFee: totalFee,
        agentEarnings: agentShare,
        colearnCommission: colearnShare,
        createdAt: new Date().toISOString(),
        type: 'colodge_deal_dispute_resolved'
      });

      // 3. Mark deal completed
      await updateDoc(doc(db, 'colodge_deals', deal.id), {
        status: 'completed',
        resolvedAt: new Date().toISOString(),
        resolvedBy: profile?.email || 'Admin'
      });

      // 4. Mark room as rented
      await updateDoc(doc(db, 'colodge_rooms', deal.roomId), {
        status: 'rented',
        rentedBy: deal.userId,
        inTalksWith: null
      });

      toast.success(`Dispute resolved: Payout dispatched (₦${agentShare.toLocaleString()} to Agent, ₦${colearnShare.toLocaleString()} to Colearn). Room marked rented.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to resolve.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 flex items-center gap-2">
            <Shield className="h-8 w-8 text-indigo-600" />
            CoLodge Management
          </h2>
          <p className="text-stone-500">Manage agent authorizations, lodging deals, disputes, bank rosters, and lodging infrastructure.</p>
        </div>
        
        {/* Toggle Permission */}
        <div className="flex items-center gap-3 bg-stone-100 dark:bg-stone-800 p-3 rounded-xl border border-stone-200 dark:border-stone-700">
          <div className="text-sm">
            <p className="font-semibold text-stone-800 dark:text-stone-200">Agents Can Add Listings</p>
            <p className="text-xs text-stone-500">Enable to let agents submit rooms/lodges</p>
          </div>
          <button onClick={handleToggleAgentsAdd} className="focus:outline-none">
            {agentsCanAddLodges ? (
              <ToggleRight className="h-10 w-10 text-emerald-600" />
            ) : (
              <ToggleLeft className="h-10 w-10 text-stone-400" />
            )}
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 dark:border-stone-700 pb-2">
        <Button variant={activeTab === 'applications' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('applications')}>
          Applications ({applications.filter(a => a.status === 'pending').length})
        </Button>
        <Button variant={activeTab === 'deals' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('deals')}>
          Active Deals & Disputes ({deals.filter(d => d.status === 'disputed' || d.status === 'payment_submitted').length})
        </Button>
        <Button variant={activeTab === 'escrow' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('escrow')}>
          Escrow Accounts
        </Button>
        <Button variant={activeTab === 'banks' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('banks')}>
          Bank & Contact Settings
        </Button>
        <Button variant={activeTab === 'infrastructure' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('infrastructure')}>
          Lodges & Rooms
        </Button>
      </div>

      {/* 1. AGENT APPLICATIONS */}
      {activeTab === 'applications' && (
        <Card className="border-stone-200/80 dark:border-stone-800 shadow-sm">
          <CardHeader>
            <CardTitle>Agent Applications</CardTitle>
            <CardDescription>Review student applications to join Colearn's ecosystem of real estate agents.</CardDescription>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="text-center py-8 text-stone-400">No applications found.</div>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-stone-50/50 dark:bg-stone-900/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-800 dark:text-stone-200 text-lg">{app.governmentName}</span>
                        <Badge className={
                          app.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' :
                          app.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400' :
                          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                        }>
                          {app.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-stone-500 text-sm mt-1">Bank: <span className="font-semibold text-stone-700 dark:text-stone-300">{app.bankName}</span> | Account: <span className="font-mono text-stone-700 dark:text-stone-300 font-bold">{app.bankAccount}</span></p>
                      <p className="text-stone-400 text-xs mt-1">Ticket Code: <span className="font-mono bg-stone-200 dark:bg-stone-800 px-1.5 py-0.5 rounded text-stone-700 dark:text-stone-300 font-bold">{app.ticketCode}</span> | Applied: {new Date(app.createdAt).toLocaleString()}</p>
                    </div>

                    {app.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApproveAgent(app)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRejectAgent(app)} className="flex items-center gap-1">
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2. DEALS & DISPUTES */}
      {activeTab === 'deals' && (
        <Card className="border-stone-200/80 dark:border-stone-800 shadow-sm">
          <CardHeader>
            <CardTitle>Active CoLodge Deals & Disputes</CardTitle>
            <CardDescription>Verify student receipts, release funds to agents, or arbitrate lodging transaction disputes.</CardDescription>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <div className="text-center py-8 text-stone-400">No active lodging transactions.</div>
            ) : (
              <div className="space-y-4">
                {deals.map((deal) => (
                  <div key={deal.id} className={`p-5 border rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${deal.status === 'disputed' ? 'border-amber-400 bg-amber-50/25 dark:bg-amber-950/10' : 'bg-stone-50/50 dark:bg-stone-900/30'}`}>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-stone-800 dark:text-stone-200 text-base">{deal.lodgeName} - {deal.roomName}</span>
                        <Badge 
                          className={
                            deal.status === 'disputed' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400' :
                            deal.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' :
                            deal.status === 'payment_submitted' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400' :
                            'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300'
                          }
                          variant="outline"
                        >
                          {deal.status.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-stone-600 dark:text-stone-300">
                        Student: <span className="font-semibold">{deal.username}</span> ({deal.userEmail}) 
                        <span className="mx-2">→</span> 
                        Agent: <span className="font-semibold">{deal.agentName}</span>
                      </p>
                      <p className="text-xs text-stone-500">
                        Escrow Fee Paid: <span className="font-bold text-stone-700 dark:text-stone-300">₦{deal.agentFeePaid.toLocaleString()}</span>
                        {deal.escrowAccountUsed && ` (Escrow Bank: ${deal.escrowAccountUsed.bankName}, Acc: ${deal.escrowAccountUsed.accountNumber})`}
                      </p>
                      {deal.status === 'disputed' && (
                        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 p-2.5 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <p><strong>Dispute Reason:</strong> {deal.disputeReason || 'One or both parties flagged lodging failure.'}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      {deal.status === 'payment_submitted' && (
                        <Button size="sm" onClick={() => handleVerifyPayment(deal)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Verify Payment
                        </Button>
                      )}
                      
                      {deal.status === 'disputed' && (
                        <>
                          <Button size="sm" onClick={() => handleResolveDisputeToAgent(deal)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" /> Resolve to Agent (90/10)
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleResolveDisputeRefund(deal)} className="flex items-center gap-1">
                            <XCircle className="h-4 w-4" /> Refund Student
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. ESCROW ACCOUNTS */}
      {activeTab === 'escrow' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Create Escrow */}
          <Card className="border-stone-200/80 dark:border-stone-800 lg:col-span-1 shadow-sm">
            <CardHeader>
              <CardTitle>Add Escrow Account</CardTitle>
              <CardDescription>Create bank accounts that will host student payments until deals are closed.</CardDescription>
            </CardHeader>
            <form onSubmit={handleAddEscrow}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input 
                    value={newEscrow.bankName} 
                    onChange={e => setNewEscrow(prev => ({ ...prev, bankName: e.target.value }))} 
                    placeholder="e.g. GTBank" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input 
                    value={newEscrow.accountNumber} 
                    onChange={e => setNewEscrow(prev => ({ ...prev, accountNumber: e.target.value }))} 
                    placeholder="10-digit number" 
                    required 
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" /> Create Escrow Account
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* List Escrows */}
          <Card className="border-stone-200/80 dark:border-stone-800 lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle>Registered Escrow Accounts</CardTitle>
              <CardDescription>Escrow accounts currently presented to students for transfers.</CardDescription>
            </CardHeader>
            <CardContent>
              {escrowAccounts.length === 0 ? (
                <div className="text-center py-8 text-stone-400">No escrow accounts registered. Please add one.</div>
              ) : (
                <div className="space-y-4">
                  {escrowAccounts.map(acc => (
                    <div key={acc.id} className="p-4 border rounded-xl flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/30">
                      <div>
                        <p className="font-bold text-stone-800 dark:text-stone-200 text-lg">{acc.bankName}</p>
                        <p className="text-stone-500 font-mono text-sm">Account Number: {acc.accountNumber}</p>
                        <p className="text-stone-400 text-xs mt-1">Status: {acc.isActive ? 'Active' : 'Inactive'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant={acc.isActive ? 'outline' : 'default'}
                          onClick={() => handleToggleEscrow(acc.id, acc.isActive)}
                        >
                          {acc.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => handleDeleteEscrow(acc.id)}
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
        </div>
      )}

      {/* 4. BANKS & SYSTEM CONTACT SETTINGS */}
      {activeTab === 'banks' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Bank Configuration */}
          <Card className="border-stone-200/80 dark:border-stone-800 shadow-sm">
            <CardHeader>
              <CardTitle>BankDropdown Setup</CardTitle>
              <CardDescription>Add or remove supported banks which agents can select during applications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddBank} className="flex gap-2">
                <Input 
                  value={newBankName} 
                  onChange={e => setNewBankName(e.target.value)} 
                  placeholder="e.g. Zenith Bank" 
                  className="flex-1"
                />
                <Button type="submit">Add Bank</Button>
              </form>

              <div className="border rounded-xl divide-y max-h-[300px] overflow-y-auto bg-stone-50/50 dark:bg-stone-900/30">
                {banks.length === 0 ? (
                  <p className="p-4 text-center text-stone-400 text-sm">No custom banks listed.</p>
                ) : (
                  banks.map(bank => (
                    <div key={bank} className="flex items-center justify-between p-3">
                      <span className="text-sm font-semibold text-stone-700 dark:text-stone-300">{bank}</span>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteBank(bank)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Verification */}
          <Card className="border-stone-200/80 dark:border-stone-800 shadow-sm">
            <CardHeader>
              <CardTitle>Verification Contact Number</CardTitle>
              <CardDescription>Setup the official WhatsApp business line where students submit receipts for verification.</CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdateWhatsapp}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>WhatsApp Hotline (Format: +234...)</Label>
                  <Input 
                    value={whatsappNumber} 
                    onChange={e => setWhatsappNumber(e.target.value)} 
                    placeholder="e.g. +2348123456789" 
                    required 
                  />
                  <p className="text-xs text-stone-500">Must include country code without spaces. When students transfer, they'll see a button to message this number on WhatsApp with their receipt.</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit">Save Verification Settings</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* 5. INFRASTRUCTURE: LOCATIONS, LODGES, ROOMS */}
      {activeTab === 'infrastructure' && (
        <div className="space-y-6">
          {/* Creation Section */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* 1. Add Location */}
            <Card className="border-stone-200/80 dark:border-stone-800 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPinIcon className="h-5 w-5 text-indigo-500" /> Create Location</CardTitle>
                <CardDescription>Add towns/sub-regions near universities.</CardDescription>
              </CardHeader>
              <form onSubmit={handleCreateLocation}>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>Location Name</Label>
                    <Input value={newLocation.name} onChange={e => setNewLocation(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Choba, Alakahia" required />
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Textarea value={newLocation.description} onChange={e => setNewLocation(prev => ({ ...prev, description: e.target.value }))} placeholder="Provide details about the locality..." required />
                  </div>
                  <div className="space-y-1">
                    <Label>University ID (At)</Label>
                    <Input value={newLocation.At} onChange={e => setNewLocation(prev => ({ ...prev, At: e.target.value }))} placeholder="e.g. UNIPORT, UNILAG" required />
                  </div>
                  <div className="space-y-1">
                    <Label>Gallery Image URLs (comma separated)</Label>
                    <Input value={newLocation.galleryInput} onChange={e => setNewLocation(prev => ({ ...prev, galleryInput: e.target.value }))} placeholder="url1, url2, url3" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full">Create Location</Button>
                </CardFooter>
              </form>
            </Card>

            {/* 2. Add Lodge */}
            <Card className="border-stone-200/80 dark:border-stone-800 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-emerald-500" /> Create Lodge</CardTitle>
                <CardDescription>Add lodges within created locations.</CardDescription>
              </CardHeader>
              <form onSubmit={handleCreateLodge}>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>Select Location</Label>
                    <Select value={newLodge.locationId} onValueChange={val => setNewLodge(prev => ({ ...prev, locationId: val }))}>
                      <SelectTrigger><SelectValue placeholder="Select Location" /></SelectTrigger>
                      <SelectContent>
                        {locations.map(loc => (
                          <SelectItem key={loc.id} value={loc.id}>{loc.name} ({loc.At})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Lodge Name</Label>
                    <Input value={newLodge.name} onChange={e => setNewLodge(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Wisdom Lodge" required />
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Textarea value={newLodge.description} onChange={e => setNewLodge(prev => ({ ...prev, description: e.target.value }))} placeholder="Lodge facilities, security, light..." required />
                  </div>
                  <div className="space-y-1">
                    <Label>University ID (At)</Label>
                    <Input value={newLodge.At} onChange={e => setNewLodge(prev => ({ ...prev, At: e.target.value }))} placeholder="e.g. UNIPORT" required />
                  </div>
                  <div className="space-y-1">
                    <Label>Gallery Image URLs (comma separated)</Label>
                    <Input value={newLodge.galleryInput} onChange={e => setNewLodge(prev => ({ ...prev, galleryInput: e.target.value }))} placeholder="url1, url2" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full">Create Lodge</Button>
                </CardFooter>
              </form>
            </Card>

            {/* 3. Add Room */}
            <Card className="border-stone-200/80 dark:border-stone-800 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-pink-500" /> Create Room</CardTitle>
                <CardDescription>Add specific rooms within lodges.</CardDescription>
              </CardHeader>
              <form onSubmit={handleCreateRoom}>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>Select Lodge</Label>
                    <Select value={newRoom.lodgeId} onValueChange={val => setNewRoom(prev => ({ ...prev, lodgeId: val }))}>
                      <SelectTrigger><SelectValue placeholder="Select Lodge" /></SelectTrigger>
                      <SelectContent>
                        {lodges.map(lg => (
                          <SelectItem key={lg.id} value={lg.id}>{lg.name} ({lg.At})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Room Title / Block</Label>
                    <Input value={newRoom.name} onChange={e => setNewRoom(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Flat 3A, Single Self-contain" required />
                  </div>
                  <div className="space-y-1">
                    <Label>Price (₦ / year)</Label>
                    <Input type="number" value={newRoom.price} onChange={e => setNewRoom(prev => ({ ...prev, price: e.target.value }))} placeholder="e.g. 150000" required />
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Textarea value={newRoom.description} onChange={e => setNewRoom(prev => ({ ...prev, description: e.target.value }))} placeholder="Water, tiled, kitchen setup details..." required />
                  </div>
                  <div className="space-y-1">
                    <Label>Room Photo URL (Limit 1)</Label>
                    <Input value={newRoom.photoUrl} onChange={e => setNewRoom(prev => ({ ...prev, photoUrl: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div className="space-y-1">
                    <Label>Room Video URL (Limit 1)</Label>
                    <Input value={newRoom.videoUrl} onChange={e => setNewRoom(prev => ({ ...prev, videoUrl: e.target.value }))} placeholder="https://..." />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full">List Room</Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          {/* Infrastructure Listing Tables */}
          <Card className="border-stone-200/80 dark:border-stone-800 shadow-sm">
            <CardHeader>
              <CardTitle>Current CoLodge Inventory</CardTitle>
              <CardDescription>View and manage existing locations, lodges, and rooms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Locations */}
              <div>
                <h4 className="font-bold text-stone-800 dark:text-stone-200 mb-2 border-b pb-1 text-base">Locations</h4>
                {locations.length === 0 ? <p className="text-stone-400 text-sm italic">No locations added.</p> : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {locations.map(loc => (
                      <div key={loc.id} className="p-3 border rounded-xl flex items-center justify-between bg-stone-50/55 dark:bg-stone-900/10">
                        <div>
                          <p className="font-bold text-sm text-stone-800 dark:text-stone-200">{loc.name}</p>
                          <p className="text-xs text-stone-500">University: {loc.At} | Images: {loc.gallery?.length || 0}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteLocation(loc.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lodges */}
              <div>
                <h4 className="font-bold text-stone-800 dark:text-stone-200 mb-2 border-b pb-1 text-base">Lodges</h4>
                {lodges.length === 0 ? <p className="text-stone-400 text-sm italic">No lodges added.</p> : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {lodges.map(lg => {
                      const loc = locations.find(l => l.id === lg.locationId);
                      return (
                        <div key={lg.id} className="p-3 border rounded-xl flex items-center justify-between bg-stone-50/55 dark:bg-stone-900/10">
                          <div>
                            <p className="font-bold text-sm text-stone-800 dark:text-stone-200">{lg.name}</p>
                            <p className="text-xs text-stone-500">Loc: {loc?.name || 'Unknown'} ({lg.At}) | Images: {lg.gallery?.length || 0}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteLodge(lg.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rooms */}
              <div>
                <h4 className="font-bold text-stone-800 dark:text-stone-200 mb-2 border-b pb-1 text-base">Rooms</h4>
                {rooms.length === 0 ? <p className="text-stone-400 text-sm italic">No rooms listed.</p> : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {rooms.map(rm => {
                      const ldg = lodges.find(l => l.id === rm.lodgeId);
                      return (
                        <div key={rm.id} className="p-3 border rounded-xl flex items-center justify-between bg-stone-50/55 dark:bg-stone-900/10">
                          <div>
                            <p className="font-bold text-sm text-stone-800 dark:text-stone-200">{rm.name}</p>
                            <p className="text-xs text-stone-500">Lodge: {ldg?.name || 'Unknown'} | Price: ₦{rm.price.toLocaleString()}/yr</p>
                            <p className="text-xs mt-1">Status: <Badge className={
                              rm.status === 'available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' :
                              rm.status === 'in talks' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400' :
                              'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300'
                            } variant="outline">{rm.status}</Badge></p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteRoom(rm.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Simple icon mappings for clean import safety
function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
