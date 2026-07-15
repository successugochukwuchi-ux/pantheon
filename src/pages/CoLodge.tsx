import React, { useState, useEffect, useRef } from 'react';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Plus, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Building, 
  Home, 
  DollarSign, 
  Settings, 
  Users, 
  ArrowLeft,
  MessageSquare,
  Copy,
  ExternalLink,
  ChevronRight,
  User,
  Image as ImageIcon,
  Play,
  Settings2,
  Wallet,
  History,
  Info,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { ColodgeLocation, ColodgeLodge, ColodgeRoom, ColodgeAgentApplication, ColodgeDeal, ColodgeEscrowAccount } from '../types';

interface ColodgeMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export default function CoLodge() {
  const { profile } = useAuth();
  const [view, setView] = useState<'student_locations' | 'student_lodges' | 'student_rooms' | 'agent_dashboard' | 'become_agent'>('student_locations');
  
  // Back navigation states
  const [selectedLocation, setSelectedLocation] = useState<ColodgeLocation | null>(null);
  const [selectedLodge, setSelectedLodge] = useState<ColodgeLodge | null>(null);

  // System Configurations
  const [banks, setBanks] = useState<string[]>([]);
  const [agentsCanAddLodges, setAgentsCanAddLodges] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Data Lists
  const [locations, setLocations] = useState<ColodgeLocation[]>([]);
  const [lodges, setLodges] = useState<ColodgeLodge[]>([]);
  const [rooms, setRooms] = useState<ColodgeRoom[]>([]);
  const [escrowAccounts, setEscrowAccounts] = useState<ColodgeEscrowAccount[]>([]);
  const [agentApplication, setAgentApplication] = useState<ColodgeAgentApplication | null>(null);
  const [studentDeals, setStudentDeals] = useState<ColodgeDeal[]>([]);
  const [agentDeals, setAgentDeals] = useState<ColodgeDeal[]>([]);
  const [universityAgents, setUniversityAgents] = useState<any[]>([]);

  // Modals / Details Views
  const [infoModal, setInfoModal] = useState<{ title: string; desc: string; gallery: string[] } | null>(null);
  const [activeDeal, setActiveDeal] = useState<ColodgeDeal | null>(null);
  const [dealMessages, setDealMessages] = useState<ColodgeMessage[]>([]);
  const [showAgentSelectionForRoom, setShowAgentSelectionForRoom] = useState<ColodgeRoom | null>(null);
  const [showPayModal, setShowPayModal] = useState<ColodgeDeal | null>(null);

  // Form inputs
  const [applyForm, setApplyForm] = useState({ governmentName: '', bankAccount: '', bankName: '' });
  const [newRoomFee, setNewRoomFee] = useState('');
  const [messageText, setMessageText] = useState('');
  const [disputeText, setDisputeText] = useState('');
  const [showDisputeInput, setShowDisputeInput] = useState(false);

  // Agent Fee Initial Prompt Form
  const [showSetFeePrompt, setShowSetFeePrompt] = useState(false);
  const [initialFeeInput, setInitialFeeInput] = useState('');

  // Ref for auto-scroll chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Agent Creation form (when toggle is enabled)
  const [showAgentCreateLodge, setShowAgentCreateLodge] = useState(false);
  const [showAgentCreateRoom, setShowAgentCreateRoom] = useState(false);
  const [agentNewLodge, setAgentNewLodge] = useState({ locationId: '', name: '', description: '', galleryInput: '' });
  const [agentNewRoom, setAgentNewRoom] = useState({ lodgeId: '', name: '', description: '', price: '', photoUrl: '', videoUrl: '' });

  // university context code
  const universityCode = profile?.At || 'UNIPORT';

  // Listen to configs
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'colodge'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBanks(data.banks || []);
        setAgentsCanAddLodges(data.agentsCanAddLodges || false);
        setWhatsappNumber(data.whatsappNumber || '');
      }
    });
    return unsub;
  }, []);

  // Listen to University Agents
  useEffect(() => {
    if (!universityCode) return;
    const codes = Array.from(new Set([universityCode.toLowerCase(), universityCode.toUpperCase()]));
    const qAgents = query(collection(db, 'users'), where('colodge_agent', '==', true), where('At', 'in', codes));
    const unsub = onSnapshot(qAgents, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push(d.data()));
      setUniversityAgents(list);
    });
    return unsub;
  }, [universityCode]);

  // Listen to Escrow accounts
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'colodge_escrow_accounts'), (snap) => {
      const list: ColodgeEscrowAccount[] = [];
      snap.forEach(d => list.push(d.data() as ColodgeEscrowAccount));
      setEscrowAccounts(list.filter(a => a.isActive));
    });
    return unsub;
  }, []);

  // Fetch student deals & application
  useEffect(() => {
    if (!profile?.uid) return;

    const unsubApp = onSnapshot(doc(db, 'colodge_agent_applications', profile.uid), (docSnap) => {
      if (docSnap.exists()) {
        setAgentApplication(docSnap.data() as ColodgeAgentApplication);
      } else {
        setAgentApplication(null);
      }
    });

    const qStudentDeals = query(collection(db, 'colodge_deals'), where('userId', '==', profile.uid));
    const unsubStudentDeals = onSnapshot(qStudentDeals, (snap) => {
      const list: ColodgeDeal[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ColodgeDeal));
      setStudentDeals(list);
    });

    const qAgentDeals = query(collection(db, 'colodge_deals'), where('agentId', '==', profile.uid));
    const unsubAgentDeals = onSnapshot(qAgentDeals, (snap) => {
      const list: ColodgeDeal[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ColodgeDeal));
      setAgentDeals(list);
    });

    return () => {
      unsubApp();
      unsubStudentDeals();
      unsubAgentDeals();
    };
  }, [profile?.uid]);

  // Prompt approved agents to set fee if undefined
  useEffect(() => {
    if (profile?.colodge_agent && profile.agentFee === undefined) {
      setShowSetFeePrompt(true);
    } else {
      setShowSetFeePrompt(false);
    }
  }, [profile]);

  // Load Locations, Lodges, Rooms in real-time
  useEffect(() => {
    if (!universityCode) return;

    const codes = Array.from(new Set([universityCode.toLowerCase(), universityCode.toUpperCase()]));

    const qLocs = query(collection(db, 'colodge_locations'), where('At', 'in', codes));
    const unsubLocs = onSnapshot(qLocs, (snap) => {
      const list: ColodgeLocation[] = [];
      snap.forEach(d => list.push(d.data() as ColodgeLocation));
      setLocations(list.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const qLodges = query(collection(db, 'colodge_lodges'), where('At', 'in', codes));
    const unsubLodges = onSnapshot(qLodges, (snap) => {
      const list: ColodgeLodge[] = [];
      snap.forEach(d => list.push(d.data() as ColodgeLodge));
      setLodges(list.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const unsubRooms = onSnapshot(collection(db, 'colodge_rooms'), (snap) => {
      const list: ColodgeRoom[] = [];
      snap.forEach(d => list.push(d.data() as ColodgeRoom));
      setRooms(list);
    });

    return () => {
      unsubLocs();
      unsubLodges();
      unsubRooms();
    };
  }, [universityCode]);

  // Deal Chat Messages Listener
  useEffect(() => {
    if (!activeDeal?.id) {
      setDealMessages([]);
      return;
    }
    const qMessages = query(collection(db, 'colodge_deals', activeDeal.id, 'messages'));
    const unsub = onSnapshot(qMessages, (snap) => {
      const list: ColodgeMessage[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ColodgeMessage));
      setDealMessages(list.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    });
    return unsub;
  }, [activeDeal]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dealMessages]);

  // BECOME AGENT HANDLER
  const handleApplyAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.governmentName || !applyForm.bankAccount || !applyForm.bankName) {
      toast.error("Please fill all application fields.");
      return;
    }
    if (!profile) return;

    try {
      // Generate 5 digit upper alphanumeric code
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let ticketCode = "";
      for (let i = 0; i < 5; i++) {
        ticketCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const application: ColodgeAgentApplication = {
        id: profile.uid,
        uid: profile.uid,
        governmentName: applyForm.governmentName,
        bankAccount: applyForm.bankAccount,
        bankName: applyForm.bankName,
        ticketCode,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'colodge_agent_applications', profile.uid), application);
      toast.success("Application submitted successfully under review!");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit application.");
    }
  };

  // AGENT FEE INITIAL LAUNCH HANDLER
  const handleSetInitialFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = Number(initialFeeInput);
    if (isNaN(fee) || fee <= 0) {
      toast.error("Please enter a valid agent fee.");
      return;
    }
    try {
      const historyEntry = { fee, changedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'users', profile!.uid), {
        agentFee: fee,
        agentFeeHistory: [historyEntry]
      });
      setShowSetFeePrompt(false);
      toast.success("Your agent fee has been configured. Happy deals!");
    } catch (e: any) {
      toast.error(e.message || "Failed to set fee.");
    }
  };

  // AGENT UPDATE FEE HANDLER
  const handleUpdateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = Number(newRoomFee);
    if (isNaN(fee) || fee <= 0) {
      toast.error("Please enter a valid positive number.");
      return;
    }
    try {
      const currentHistory = profile?.agentFeeHistory || [];
      const updatedHistory = [...currentHistory, { fee, changedAt: new Date().toISOString() }];
      await updateDoc(doc(db, 'users', profile!.uid), {
        agentFee: fee,
        agentFeeHistory: updatedHistory
      });
      setNewRoomFee('');
      toast.success("Agent fee updated successfully.");
    } catch (e: any) {
      toast.error(e.message || "Failed to update agent fee.");
    }
  };

  // AGENT WITHDRAW HANDLER
  const handleWithdrawal = async () => {
    const currentBalance = profile?.walletBalance || 0;
    if (currentBalance <= 0) {
      toast.error("No funds available in your balance.");
      return;
    }
    try {
      // 1. Deduct balance on profile
      await updateDoc(doc(db, 'users', profile!.uid), {
        walletBalance: 0
      });

      // 2. Create withdrawal request entry
      await addDoc(collection(db, 'colodge_withdrawal_requests'), {
        agentId: profile!.uid,
        agentName: profile!.agentGovernmentName || profile!.username || 'Agent',
        amount: currentBalance,
        bankAccount: profile!.agentBankAccount,
        bankName: profile!.agentBankName,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      toast.success(`Withdrawal request of ₦${currentBalance.toLocaleString()} submitted successfully. Processed within 24 hours!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to process withdrawal.");
    }
  };

  // CHOOSE AGENT FOR TALKS HANDLER
  const handleChooseAgentForTalks = async (agent: any) => {
    if (!showAgentSelectionForRoom) return;
    try {
      const room = showAgentSelectionForRoom;
      const ldg = lodges.find(l => l.id === room.lodgeId);
      const dealId = `deal_${Date.now()}`;

      // Create deal doc
      const deal: ColodgeDeal = {
        id: dealId,
        roomId: room.id,
        roomName: room.name,
        lodgeId: room.lodgeId,
        lodgeName: ldg?.name || 'Lodge',
        locationId: ldg?.locationId || '',
        userId: profile!.uid,
        username: profile!.username || 'Student',
        userEmail: profile!.email,
        agentId: agent.uid,
        agentName: agent.agentGovernmentName || agent.username || 'Agent',
        agentFeePaid: agent.agentFee || 5000,
        status: 'in_talks',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'colodge_deals', dealId), deal);

      // Create first welcome message from agent
      await addDoc(collection(db, 'colodge_deals', dealId, 'messages'), {
        senderId: agent.uid,
        senderName: agent.agentGovernmentName || agent.username || 'Agent',
        text: `Hello! I am ${agent.agentGovernmentName || agent.username}, your assigned real estate agent for this lodge room (${room.name} in ${ldg?.name}). Feel free to ask me anything about the room. Tap 'Pay Agent Fee' at the top to complete payment securely to Colearn escrow.`,
        createdAt: new Date().toISOString()
      });

      setShowAgentSelectionForRoom(null);
      setActiveDeal(deal);
      toast.success("Talks initiated! Chatting with agent.");
    } catch (e: any) {
      toast.error(e.message || "Failed to initiate talks.");
    }
  };

  // SEND CHAT MESSAGE HANDLER
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeDeal) return;

    try {
      await addDoc(collection(db, 'colodge_deals', activeDeal.id, 'messages'), {
        senderId: profile!.uid,
        senderName: profile!.colodge_agent ? (profile?.agentGovernmentName || profile?.username || 'Agent') : (profile?.username || 'Student'),
        text: messageText.trim(),
        createdAt: new Date().toISOString()
      });
      setMessageText('');
    } catch (e: any) {
      toast.error("Failed to send message.");
    }
  };

  // SUBMIT PAYMENT RECIEPT HANDLER
  const handleSubmitReceipt = async () => {
    if (!showPayModal) return;
    try {
      const escrow = escrowAccounts[Math.floor(Math.random() * escrowAccounts.length)] || { accountNumber: '1234567890', bankName: 'GTBank' };
      await updateDoc(doc(db, 'colodge_deals', showPayModal.id), {
        status: 'payment_submitted',
        paymentSubmittedAt: new Date().toISOString(),
        escrowAccountUsed: {
          accountNumber: escrow.accountNumber,
          bankName: escrow.bankName
        }
      });
      setShowPayModal(null);
      if (activeDeal && activeDeal.id === showPayModal.id) {
        setActiveDeal(prev => prev ? ({ ...prev, status: 'payment_submitted' }) : null);
      }
      toast.success("Receipt notification sent! Admin will verify. WhatsApp button is visible to send screenshot.");
    } catch (e: any) {
      toast.error("Failed to submit receipt.");
    }
  };

  // CONFIRM LODGED HANDLER (Both Sides)
  const handleConfirmLodged = async () => {
    if (!activeDeal) return;
    try {
      const nextStatus = profile?.colodge_agent ? 'agent_confirmed_lodged' : 'user_confirmed_lodged';
      
      // Let's check if the other side already confirmed
      const freshDoc = await getDoc(doc(db, 'colodge_deals', activeDeal.id));
      const dealData = freshDoc.data() as ColodgeDeal;

      let isFullyConfirmed = false;
      if (profile?.colodge_agent && dealData.status === 'user_confirmed_lodged') {
        isFullyConfirmed = true;
      } else if (!profile?.colodge_agent && dealData.status === 'agent_confirmed_lodged') {
        isFullyConfirmed = true;
      }

      if (isFullyConfirmed) {
        const totalFee = dealData.agentFeePaid;
        const agentShare = totalFee * 0.9;
        const colearnShare = totalFee * 0.1;

        // 1. Credit agent wallet
        await updateDoc(doc(db, 'users', dealData.agentId), {
          walletBalance: increment(agentShare)
        });

        // 2. Log colearn commission revenue
        await addDoc(collection(db, 'colearn_revenue_reports'), {
          dealId: dealData.id,
          roomId: dealData.roomId,
          agentId: dealData.agentId,
          agentName: dealData.agentName,
          totalAgentFee: totalFee,
          agentEarnings: agentShare,
          colearnCommission: colearnShare,
          createdAt: new Date().toISOString(),
          type: 'colodge_deal_completed',
          At: universityCode
        });

        // 3. Mark room as rented
        await updateDoc(doc(db, 'colodge_rooms', dealData.roomId), {
          status: 'rented',
          rentedBy: dealData.userId,
          inTalksWith: null
        });

        // 4. Complete deal
        await updateDoc(doc(db, 'colodge_deals', activeDeal.id), {
          status: 'completed'
        });

        setActiveDeal(prev => prev ? ({ ...prev, status: 'completed' }) : null);
        toast.success(`Success! Deal completed. ₦${agentShare.toLocaleString()} credited to Agent, ₦${colearnShare.toLocaleString()} commissions logged for Colearn!`);
      } else {
        await updateDoc(doc(db, 'colodge_deals', activeDeal.id), {
          status: nextStatus
        });
        setActiveDeal(prev => prev ? ({ ...prev, status: nextStatus }) : null);
        toast.success("Confirmation saved! Waiting for the other party to confirm.");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to confirm.");
    }
  };

  // TRIGGER DISPUTE HANDLER
  const handleRaiseDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeal || !disputeText.trim()) return;
    try {
      await updateDoc(doc(db, 'colodge_deals', activeDeal.id), {
        status: 'disputed',
        disputeReason: disputeText.trim()
      });
      setActiveDeal(prev => prev ? ({ ...prev, status: 'disputed', disputeReason: disputeText.trim() }) : null);
      setShowDisputeInput(false);
      setDisputeText('');
      toast.warning("Dispute submitted. A level 4 admin will review and arbitrate this transaction.");
    } catch (err) {
      toast.error("Failed to raise dispute.");
    }
  };

  // STUDENT PRESS RENT ROOM BUTTON
  const handleRentRoom = async (room: ColodgeRoom) => {
    try {
      // 1. Mark room status in-talks
      await updateDoc(doc(db, 'colodge_rooms', room.id), {
        status: 'in talks',
        inTalksWith: profile!.uid
      });

      // 2. Prompt user to choose an agent to assist with this room
      setShowAgentSelectionForRoom(room);
      toast.success("Room selected! Please pick one of our verified university agents below to begin.");
    } catch (e: any) {
      toast.error("Failed to initiate rent request.");
    }
  };

  // AGENT ADD LOCATION/LODGE/ROOM AGENT-GROWTH FEATURE (When toggle enabled)
  const handleAgentAddLodge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentNewLodge.locationId || !agentNewLodge.name || !agentNewLodge.description) {
      toast.error("Please fill required fields.");
      return;
    }
    try {
      const gallery = agentNewLodge.galleryInput
        ? agentNewLodge.galleryInput.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const newId = `lodge_${Date.now()}`;
      await setDoc(doc(db, 'colodge_lodges', newId), {
        id: newId,
        locationId: agentNewLodge.locationId,
        name: agentNewLodge.name,
        description: agentNewLodge.description,
        gallery,
        At: universityCode,
        createdAt: new Date().toISOString()
      });
      setAgentNewLodge({ locationId: '', name: '', description: '', galleryInput: '' });
      setShowAgentCreateLodge(false);
      toast.success("Lodge listed successfully for review!");
    } catch (e: any) {
      toast.error("Failed to list lodge.");
    }
  };

  const handleAgentAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentNewRoom.lodgeId || !agentNewRoom.name || !agentNewRoom.description || !agentNewRoom.price) {
      toast.error("Please fill required fields.");
      return;
    }
    try {
      const newId = `room_${Date.now()}`;
      await setDoc(doc(db, 'colodge_rooms', newId), {
        id: newId,
        lodgeId: agentNewRoom.lodgeId,
        name: agentNewRoom.name,
        description: agentNewRoom.description,
        photoUrl: agentNewRoom.photoUrl.trim() || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
        videoUrl: agentNewRoom.videoUrl.trim() || '',
        price: Number(agentNewRoom.price),
        status: 'available',
        createdAt: new Date().toISOString()
      });
      setAgentNewRoom({ lodgeId: '', name: '', description: '', price: '', photoUrl: '', videoUrl: '' });
      setShowAgentCreateRoom(false);
      toast.success("Room listed and open for renting!");
    } catch (e: any) {
      toast.error("Failed to list room.");
    }
  };

  // Render UI Views helper
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Set Agent Fee Prompt Modal */}
      {showSetFeePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <Card className="max-w-md w-full mx-4 shadow-xl border-stone-200 dark:border-stone-800">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2 text-indigo-600">
                <Briefcase className="h-6 w-6" /> Welcome, Agent!
              </CardTitle>
              <CardDescription>
                Your application has been approved! Before you can take on lodging deals, please set your default agent fee. Students will see this fee during chats.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSetInitialFee}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Agent Fee (₦ / deal)</Label>
                  <Input 
                    type="number" 
                    value={initialFeeInput} 
                    onChange={e => setInitialFeeInput(e.target.value)} 
                    placeholder="e.g. 5000" 
                    required 
                  />
                  <p className="text-xs text-stone-500">Note: Colearn takes a 10% commission on finalized deals. You take 90% of this fee directly into your wallet.</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full">Activate My Agent Dashboard</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* Info Gallery Modal */}
      {infoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">{infoModal.title}</CardTitle>
                <CardDescription>Description and media gallery</CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setInfoModal(null)} className="rounded-full">✕</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap">{infoModal.desc}</p>
              
              <div>
                <h4 className="font-bold text-stone-900 dark:text-stone-100 mb-2">Photo Gallery</h4>
                {infoModal.gallery.length === 0 ? (
                  <p className="text-stone-400 text-sm italic">No images in gallery.</p>
                ) : (
                  <div className="grid gap-4 grid-cols-2">
                    {infoModal.gallery.map((url, idx) => (
                      <img 
                        key={idx} 
                        src={url} 
                        alt="Gallery item" 
                        referrerPolicy="no-referrer"
                        className="rounded-xl object-cover w-full h-44 border bg-stone-100 shadow-xs" 
                      />
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => setInfoModal(null)}>Close Info Panel</Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Choose Agent Selection Modal */}
      {showAgentSelectionForRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="max-w-lg w-full shadow-2xl border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-6 w-6 text-indigo-600" /> Choose Certified Agent
              </CardTitle>
              <CardDescription>
                Select an authorized CoLodge agent at {universityCode} to proceed with renting "{showAgentSelectionForRoom.name}".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {universityAgents.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">No available agents</p>
                  <p className="text-xs text-stone-500">There are no approved agents currently operating inside {universityCode}. Please apply or wait for admins to appoint one.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {universityAgents.map(agent => (
                    <div key={agent.uid} className="flex items-center justify-between p-3 border rounded-xl bg-stone-50 dark:bg-stone-900/30">
                      <div>
                        <p className="font-bold text-stone-800 dark:text-stone-200">{agent.agentGovernmentName || agent.username}</p>
                        <p className="text-xs text-stone-500">Agent Fee: <span className="font-bold text-indigo-600">₦{(agent.agentFee || 5000).toLocaleString()}</span></p>
                      </div>
                      <Button size="sm" onClick={() => handleChooseAgentForTalks(agent)}>Chat with Agent</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => {
                // Free room back up if cancelled
                updateDoc(doc(db, 'colodge_rooms', showAgentSelectionForRoom.id), {
                  status: 'available',
                  inTalksWith: null
                });
                setShowAgentSelectionForRoom(null);
              }}>Cancel renting</Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Escrow Fee Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="max-w-md w-full shadow-2xl border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-indigo-600 flex items-center gap-2">
                <Wallet className="h-5 w-5" /> CoLearn Escrow Payment
              </CardTitle>
              <CardDescription>
                Transfer the agent fee directly to the secure colearn escrow bank account. Funds are released to the agent only after you confirm successful lodging.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-stone-100 dark:bg-stone-800 rounded-xl space-y-2 border">
                <p className="text-xs text-stone-500 uppercase font-black">Escrow Bank Details</p>
                {escrowAccounts.length === 0 ? (
                  <div>
                    <p className="font-bold text-lg text-stone-800 dark:text-stone-200">CoLearn Treasury Bank</p>
                    <p className="text-xl font-mono font-black text-indigo-600 tracking-wider">1234567890</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-lg text-stone-800 dark:text-stone-200">{escrowAccounts[0].bankName}</p>
                    <p className="text-xl font-mono font-black text-indigo-600 tracking-wider flex items-center justify-between">
                      {escrowAccounts[0].accountNumber}
                      <Button size="xs" variant="ghost" onClick={() => {
                        navigator.clipboard.writeText(escrowAccounts[0].accountNumber);
                        toast.success("Account number copied!");
                      }}><Copy className="h-4 w-4" /></Button>
                    </p>
                  </div>
                )}
                <div className="border-t pt-2 mt-2">
                  <p className="text-sm">Amount to Pay: <span className="font-bold text-stone-800 dark:text-stone-200">₦{showPayModal.agentFeePaid.toLocaleString()}</span></p>
                </div>
              </div>

              <div className="text-xs text-stone-500 space-y-2 leading-relaxed">
                <p>1. Open your banking app and transfer exactly the amount above to the Escrow account.</p>
                <p>2. Screenshot the transfer receipt.</p>
                <p>3. Tap 'I've Sent The Receipt' below, then tap 'Send Screenshot on WhatsApp' to submit the screenshot to our support number ({whatsappNumber}) for swift admin confirmation.</p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button onClick={handleSubmitReceipt} className="w-full">I've Sent The Receipt</Button>
              <Button variant="outline" className="w-full" onClick={() => setShowPayModal(null)}>Cancel</Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-stone-200 dark:border-stone-800">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full">CoLodge Subsystem</span>
          <h1 className="text-4xl font-extrabold text-stone-900 dark:text-stone-50 mt-1.5 flex items-center gap-2">
            <Building className="h-8 w-8 text-indigo-600" />
            University CoLodge
          </h1>
          <p className="text-stone-500 text-sm mt-1">Rent beautiful off-campus accommodation near {universityCode} with security, transparency, and verified agent support.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Main Toggle Dashboard vs Home */}
          {profile?.colodge_agent ? (
            <Button 
              variant={view === 'agent_dashboard' ? 'outline' : 'default'}
              onClick={() => {
                if (view === 'agent_dashboard') {
                  setView('student_locations');
                  setSelectedLocation(null);
                  setSelectedLodge(null);
                } else {
                  setView('agent_dashboard');
                }
              }}
              className="flex items-center gap-1.5 font-bold"
            >
              {view === 'agent_dashboard' ? (
                <><Home className="h-4 w-4" /> Browse Lodges</>
              ) : (
                <><Briefcase className="h-4 w-4" /> Agent Dashboard</>
              )}
            </Button>
          ) : (
            <Button 
              variant={view === 'become_agent' ? 'outline' : 'default'}
              onClick={() => {
                if (view === 'become_agent') {
                  setView('student_locations');
                  setSelectedLocation(null);
                  setSelectedLodge(null);
                } else {
                  setView('become_agent');
                }
              }}
              className="flex items-center gap-1.5 font-bold"
            >
              {view === 'become_agent' ? (
                <><Home className="h-4 w-4" /> Browse Lodges</>
              ) : (
                <><Users className="h-4 w-4" /> Become an Agent</>
              )}
            </Button>
          )}

          {activeDeal && (
            <Button variant="secondary" onClick={() => setActiveDeal(null)} className="flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to Listings
            </Button>
          )}
        </div>
      </div>

      {/* SPLIT SCREEN CHAT & CONTENT */}
      {activeDeal ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 1. ROOM INFO & ESCROW BUTTONS */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
              <CardHeader>
                <Badge variant="outline" className="w-fit border-indigo-200 bg-indigo-50/50 text-indigo-700">ACTIVE TALKS</Badge>
                <CardTitle className="text-xl mt-2">{activeDeal.lodgeName}</CardTitle>
                <CardDescription>Room: {activeDeal.roomName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-lg space-y-1 text-sm border">
                  <p className="text-stone-500">Assigned Agent</p>
                  <p className="font-bold text-stone-800 dark:text-stone-200">{activeDeal.agentName}</p>
                  <p className="text-xs text-stone-400">Fixed Fee: ₦{activeDeal.agentFeePaid.toLocaleString()}</p>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-lg space-y-1 text-sm border">
                  <p className="text-stone-500">Deal Status</p>
                  <p className="font-bold capitalize text-indigo-600">{activeDeal.status.replace(/_/g, ' ')}</p>
                </div>

                {/* ESCROW CONTROL BUTTONS */}
                {!profile?.colodge_agent ? (
                  // Student Controls
                  <div className="space-y-3 pt-2">
                    {activeDeal.status === 'in_talks' && (
                      <Button onClick={() => setShowPayModal(activeDeal)} className="w-full flex items-center justify-center gap-1.5 font-bold">
                        <DollarSign className="h-4 w-4" /> Pay Agent Fee
                      </Button>
                    )}

                    {activeDeal.status === 'payment_submitted' && (
                      <div className="space-y-2">
                        <Button onClick={() => setShowPayModal(activeDeal)} variant="outline" className="w-full">
                          Paid. Made a mistake? Try again.
                        </Button>
                        <a 
                          href={`https://wa.me/${whatsappNumber.replace('+', '')}?text=Hello,%20I've%20just%20paid%20the%20escrow%20agent%20fee%20of%20NGN%20${activeDeal.agentFeePaid}%20for%20room%20${activeDeal.roomName}%20in%20${activeDeal.lodgeName}.%20My%20email%20is%20${profile?.email}.%20Here's%20my%20screenshot%20receipt:`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 text-sm font-bold p-2 rounded-lg cursor-pointer transition-all"
                        >
                          <MessageSquare className="h-4 w-4" /> Send Screenshot on WhatsApp
                        </a>
                      </div>
                    )}

                    {activeDeal.status === 'payment_confirmed' && (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs font-semibold text-stone-500">Is your lodging finalized? Confirm to dispatch agent funds:</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={handleConfirmLodged} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1 text-xs">
                            <CheckCircle className="h-4 w-4" /> I'm Lodged
                          </Button>
                          <Button onClick={() => { setShowDisputeInput(true); setShowDisputeInput(!showDisputeInput); }} variant="destructive" className="font-bold flex items-center justify-center gap-1 text-xs">
                            <XCircle className="h-4 w-4" /> Not Lodged / Dispute
                          </Button>
                        </div>
                      </div>
                    )}

                    {activeDeal.status === 'user_confirmed_lodged' && (
                      <p className="text-xs text-amber-600 text-center italic bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200">You've confirmed lodging! Waiting for agent confirmation.</p>
                    )}

                    {activeDeal.status === 'agent_confirmed_lodged' && (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs font-semibold text-indigo-600">The agent confirms you've successfully moved in! Please finalize the deal:</p>
                        <Button onClick={handleConfirmLodged} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                          Confirm & Lodge (Releases Funds)
                        </Button>
                      </div>
                    )}

                    {activeDeal.status === 'completed' && (
                      <p className="text-xs text-emerald-600 text-center font-bold bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200">Lodging completed successfully. Happy living!</p>
                    )}
                  </div>
                ) : (
                  // Agent Controls
                  <div className="space-y-3 pt-2">
                    {activeDeal.status === 'payment_submitted' && (
                      <p className="text-xs text-amber-600 text-center bg-amber-50 dark:bg-amber-950/10 p-2.5 rounded-lg border border-amber-200 italic">User submitted payment receipt. Admin is verifying. Hold tight!</p>
                    )}

                    {activeDeal.status === 'payment_confirmed' && (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs font-semibold text-stone-500">Payment confirmed by Colearn. Once the user is safely lodged, confirm to claim earnings:</p>
                        <Button onClick={handleConfirmLodged} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle className="h-4 w-4" /> Confirm User Lodged
                        </Button>
                      </div>
                    )}

                    {activeDeal.status === 'agent_confirmed_lodged' && (
                      <p className="text-xs text-indigo-600 text-center italic bg-indigo-50 dark:bg-indigo-950/10 p-2 rounded-lg border border-indigo-200">You have confirmed lodging. Waiting for student confirmation.</p>
                    )}

                    {activeDeal.status === 'user_confirmed_lodged' && (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs font-semibold text-emerald-600">The student confirmed they have moved in! Finalize to withdraw:</p>
                        <Button onClick={handleConfirmLodged} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle className="h-4 w-4" /> Finalize Deal & Collect Earnings
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* DISPUTE FORM */}
                {showDisputeInput && (
                  <form onSubmit={handleRaiseDispute} className="space-y-2 border-t pt-3">
                    <Label className="text-xs text-red-600 font-bold">State dispute details</Label>
                    <Textarea 
                      value={disputeText} 
                      onChange={e => setDisputeText(e.target.value)} 
                      placeholder="Explain what went wrong in detail..." 
                      className="text-xs"
                      required 
                    />
                    <Button type="submit" size="sm" variant="destructive" className="w-full text-xs">Submit Dispute to Admin</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 2. CHAT FEED & MESSAGE INPUT */}
          <div className="lg:col-span-2 flex flex-col h-[550px] border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-sm">
            <div className="bg-stone-50 dark:bg-stone-900/60 p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-100 dark:bg-indigo-950 p-2 rounded-full text-indigo-600">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                    {profile?.colodge_agent ? activeDeal.username : activeDeal.agentName}
                  </p>
                  <p className="text-xs text-stone-400">Deal Chat Room • {activeDeal.roomName}</p>
                </div>
              </div>
            </div>

            {/* MESSAGE FEED */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/30 dark:bg-stone-950/10">
              {dealMessages.length === 0 ? (
                <div className="text-center py-20 text-stone-400 text-sm">No messages yet. Send a message to start lodging discussions.</div>
              ) : (
                dealMessages.map((msg) => {
                  const isMe = msg.senderId === profile?.uid;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-3 max-w-md rounded-2xl text-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-xs shadow-xs' : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-tl-xs shadow-xs'}`}>
                        {!isMe && <span className="block text-[10px] font-bold opacity-75 mb-1">{msg.senderName}</span>}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <span className="block text-[9px] opacity-60 text-right mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* SEND MESSAGE BAR */}
            <form onSubmit={handleSendMessage} className="p-3 border-t bg-white dark:bg-stone-900 flex gap-2">
              <Input 
                value={messageText} 
                onChange={e => setMessageText(e.target.value)} 
                placeholder="Type your message here..." 
                className="flex-1 focus:ring-1 focus:ring-indigo-500 text-sm"
              />
              <Button type="submit">Send</Button>
            </form>
          </div>
        </div>
      ) : (
        // LISTINGS AND REGISTRATIONS
        <div>
          {/* BECOME AN AGENT SCREEN */}
          {view === 'become_agent' && (
            <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
              {/* Application details Card */}
              <Card className="border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2 text-indigo-600">
                    <Briefcase className="h-6 w-6" /> Earn Money as a CoLodge Agent
                  </CardTitle>
                  <CardDescription>Operate as Colearn's certified real estate facilitator for off-campus lodging near your university.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-stone-600 dark:text-stone-300 text-sm leading-relaxed">
                  <p>CoLodge helps the student community find suitable nearby lodging with extreme safety, completely cutting out fraudulent brokers.</p>
                  
                  <div className="space-y-3 bg-indigo-50/40 dark:bg-indigo-950/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                    <h4 className="font-bold text-indigo-900 dark:text-indigo-400 flex items-center gap-1.5"><Info className="h-4 w-4" /> Core Rules & Agent Conduct:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-xs">
                      <li>Colearn charges a fixed <strong>10% service commission</strong> on completed deals, you take <strong>90% of the agent fee</strong>.</li>
                      <li>Payment is held in a secure Colearn escrow and dispatched to your wallet balance only after the student confirms lodging.</li>
                      <li>Any case of listing fake rooms, misrepresenting facilities, or fraud leads to an immediate <strong>permanent ban</strong> and potential legal referral.</li>
                    </ul>
                  </div>
                </CardContent>
                <CardFooter className="text-xs text-stone-400">Colearn ecosystem protects both student tenants and active agents.</CardFooter>
              </Card>

              {/* Form Card */}
              <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
                <CardHeader>
                  <CardTitle>Submit Registration</CardTitle>
                  <CardDescription>Fill in your details exactly as shown on your bank credentials.</CardDescription>
                </CardHeader>
                {agentApplication ? (
                  <CardContent className="space-y-4 py-8 text-center">
                    {agentApplication.status === 'pending' ? (
                      <div className="space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 p-4 rounded-xl border border-amber-200/40">
                          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                          <h4 className="font-bold">Application Pending Review</h4>
                          <p className="text-xs mt-1">Admins are verifying your banking and identity details. Copy the unique ticket below to track request status with admins.</p>
                        </div>
                        <div className="p-4 border rounded-xl bg-stone-50 dark:bg-stone-900/40 space-y-1">
                          <p className="text-xs text-stone-400 font-bold tracking-wider uppercase">Application Ticket</p>
                          <p className="text-3xl font-mono font-black text-indigo-600 tracking-widest">{agentApplication.ticketCode}</p>
                          <Button size="sm" variant="ghost" className="mt-2" onClick={() => {
                            navigator.clipboard.writeText(agentApplication.ticketCode);
                            toast.success("Ticket code copied!");
                          }}><Copy className="h-4 w-4 mr-1" /> Copy Ticket Code</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 p-4 rounded-xl border border-red-200/40">
                          <XCircle className="h-8 w-8 mx-auto mb-2" />
                          <h4 className="font-bold">Application Rejected</h4>
                          <p className="text-xs mt-1">Your details could not be verified. Please double check and resubmit if necessary.</p>
                        </div>
                        <Button variant="outline" onClick={() => {
                          deleteDoc(doc(db, 'colodge_agent_applications', profile!.uid));
                          setAgentApplication(null);
                        }}>Resubmit Application</Button>
                      </div>
                    )}
                  </CardContent>
                ) : (
                  <form onSubmit={handleApplyAgent}>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <Label>Government Full Name</Label>
                        <Input 
                          value={applyForm.governmentName} 
                          onChange={e => setApplyForm(prev => ({ ...prev, governmentName: e.target.value }))} 
                          placeholder="e.g. John Smith Benson" 
                          required 
                        />
                        <p className="text-[10px] text-stone-500">Ensure this matches the name on your bank account exactly, or application will fail.</p>
                      </div>

                      <div className="space-y-1">
                        <Label>Select Bank</Label>
                        <Select value={applyForm.bankName} onValueChange={val => setApplyForm(prev => ({ ...prev, bankName: val }))}>
                          <SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger>
                          <SelectContent>
                            {banks.map(bank => (
                              <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Bank Account Number</Label>
                        <Input 
                          value={applyForm.bankAccount} 
                          onChange={e => setApplyForm(prev => ({ ...prev, bankAccount: e.target.value }))} 
                          placeholder="10-digit account number" 
                          required 
                        />
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" className="w-full">Submit Application</Button>
                    </CardFooter>
                  </form>
                )}
              </Card>
            </div>
          )}

          {/* AGENT DASHBOARD SECTION */}
          {view === 'agent_dashboard' && (
            <div className="space-y-6">
              {/* Top Stats and Withdrawal */}
              <div className="grid gap-6 md:grid-cols-3">
                {/* Balance Wallet */}
                <Card className="border-stone-200 dark:border-stone-800 shadow-sm bg-indigo-600 text-white">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-1.5 opacity-90"><Wallet className="h-5 w-5" /> Wallet Balance</CardTitle>
                    <div className="pt-2">
                      <span className="text-4xl font-extrabold">₦{(profile?.walletBalance || 0).toLocaleString()}</span>
                    </div>
                  </CardHeader>
                  <CardFooter>
                    <Button variant="secondary" className="w-full font-bold" onClick={handleWithdrawal} disabled={(profile?.walletBalance || 0) <= 0}>
                      Withdraw Earnings
                    </Button>
                  </CardFooter>
                </Card>

                {/* Configuration / Fee setup */}
                <Card className="border-stone-200 dark:border-stone-800 shadow-sm md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-1.5 text-stone-800 dark:text-stone-200"><Settings2 className="h-5 w-5" /> Agent Fee Settings</CardTitle>
                    <CardDescription>Configure the flat fee students pay you to secure a room.</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleUpdateFee}>
                    <CardContent className="flex gap-4">
                      <div className="flex-1 space-y-2">
                        <Label>Agent Fee per Room (₦)</Label>
                        <Input 
                          type="number" 
                          value={newRoomFee} 
                          onChange={e => setNewRoomFee(e.target.value)} 
                          placeholder={`Current: ₦${(profile?.agentFee || 0).toLocaleString()}`} 
                          required 
                        />
                      </div>
                      <Button type="submit" className="self-end">Save Fee</Button>
                    </CardContent>
                  </form>
                </Card>
              </div>

              {/* split view for agent: deals & agent-adding features */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Active Deals / Chats sidebar */}
                <Card className="border-stone-200 dark:border-stone-800 shadow-sm lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-indigo-600" /> Active Chats
                    </CardTitle>
                    <CardDescription>Chat and finalise lodging deals with prospective students.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {agentDeals.length === 0 ? (
                      <p className="p-6 text-center text-stone-400 text-sm">No active lodging chats.</p>
                    ) : (
                      <div className="divide-y max-h-[400px] overflow-y-auto">
                        {agentDeals.map(deal => (
                          <button 
                            key={deal.id} 
                            onClick={() => setActiveDeal(deal)}
                            className="w-full text-left p-4 hover:bg-stone-50 dark:hover:bg-stone-900/40 flex items-center justify-between transition-colors"
                          >
                            <div>
                              <p className="font-bold text-stone-800 dark:text-stone-200 text-sm">{deal.username}</p>
                              <p className="text-xs text-stone-400">{deal.lodgeName} • {deal.roomName}</p>
                            </div>
                            <div className="text-right">
                              <Badge className={`text-[10px] ${
                                deal.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                deal.status === 'disputed' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400' :
                                'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300'
                              }`} variant="outline">
                                {deal.status.replace(/_/g, ' ')}
                              </Badge>
                              <p className="text-[10px] text-stone-400 mt-1">{new Date(deal.createdAt).toLocaleDateString()}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Subsystem Agent Growth Section */}
                <Card className="border-stone-200 dark:border-stone-800 shadow-sm lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-stone-800 dark:text-stone-200">
                      <Building className="h-5 w-5 text-indigo-600" /> Lodge Listings Management
                    </CardTitle>
                    <CardDescription>Submit nearby towns, lodges, or rooms to expand CoLodge coverage.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {agentsCanAddLodges ? (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Button variant={showAgentCreateLodge ? "default" : "outline"} onClick={() => { setShowAgentCreateLodge(!showAgentCreateLodge); setShowAgentCreateRoom(false); }}>
                            Submit New Lodge
                          </Button>
                          <Button variant={showAgentCreateRoom ? "default" : "outline"} onClick={() => { setShowAgentCreateRoom(!showAgentCreateRoom); setShowAgentCreateLodge(false); }}>
                            List New Room
                          </Button>
                        </div>

                        {/* Lodge Creation */}
                        {showAgentCreateLodge && (
                          <form onSubmit={handleAgentAddLodge} className="p-4 border rounded-xl space-y-4 bg-stone-50 dark:bg-stone-900/30">
                            <h4 className="font-bold">Register Lodge</h4>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label>Location</Label>
                                <Select value={agentNewLodge.locationId} onValueChange={val => setAgentNewLodge(prev => ({ ...prev, locationId: val }))}>
                                  <SelectTrigger><SelectValue placeholder="Select Location" /></SelectTrigger>
                                  <SelectContent>
                                    {locations.map(loc => (
                                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label>Lodge Name</Label>
                                <Input value={agentNewLodge.name} onChange={e => setAgentNewLodge(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Divine Lodge" required />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label>Description</Label>
                              <Textarea value={agentNewLodge.description} onChange={e => setAgentNewLodge(prev => ({ ...prev, description: e.target.value }))} placeholder="Lodge water, electricity facilities..." required />
                            </div>
                            <div className="space-y-1">
                              <Label>Gallery Image URLs (comma-separated)</Label>
                              <Input value={agentNewLodge.galleryInput} onChange={e => setAgentNewLodge(prev => ({ ...prev, galleryInput: e.target.value }))} placeholder="url1, url2" />
                            </div>
                            <Button type="submit">Submit Lodge Registration</Button>
                          </form>
                        )}

                        {/* Room Creation */}
                        {showAgentCreateRoom && (
                          <form onSubmit={handleAgentAddRoom} className="p-4 border rounded-xl space-y-4 bg-stone-50 dark:bg-stone-900/30">
                            <h4 className="font-bold">Register Room</h4>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label>Lodge</Label>
                                <Select value={agentNewRoom.lodgeId} onValueChange={val => setAgentNewRoom(prev => ({ ...prev, lodgeId: val }))}>
                                  <SelectTrigger><SelectValue placeholder="Select Lodge" /></SelectTrigger>
                                  <SelectContent>
                                    {lodges.map(l => (
                                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label>Room Name/Flat</Label>
                                <Input value={agentNewRoom.name} onChange={e => setAgentNewRoom(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Block C Room 4" required />
                              </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label>Price (₦ / yr)</Label>
                                <Input type="number" value={agentNewRoom.price} onChange={e => setAgentNewRoom(prev => ({ ...prev, price: e.target.value }))} placeholder="e.g. 150000" required />
                              </div>
                              <div className="space-y-1">
                                <Label>Photo URL</Label>
                                <Input value={agentNewRoom.photoUrl} onChange={e => setAgentNewRoom(prev => ({ ...prev, photoUrl: e.target.value }))} placeholder="https://..." />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label>Description</Label>
                              <Textarea value={agentNewRoom.description} onChange={e => setAgentNewRoom(prev => ({ ...prev, description: e.target.value }))} placeholder="Water, tiled, kitchen setup details..." required />
                            </div>
                            <Button type="submit">Submit and Open Listings</Button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-10 border rounded-xl border-dashed">
                        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                        <h4 className="font-bold">Submission Closed by Administrator</h4>
                        <p className="text-sm text-stone-500 max-w-sm mx-auto">Admin currently toggled submissions off. Only administrators can add rooms/lodges at this time.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* STUDENT CO-LODGE EXPLORER VIEW */}
          {view === 'student_locations' && (
            <div className="space-y-6">
              {/* Active Student Deals banner if any exist */}
              {studentDeals.filter(d => d.status !== 'completed' && d.status !== 'cancelled_refunded').length > 0 && (
                <div className="p-4 border border-indigo-200 bg-indigo-50/40 rounded-xl space-y-2">
                  <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-1"><MessageSquare className="h-4 w-4" /> Active Lodging Discussions</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {studentDeals.filter(d => d.status !== 'completed' && d.status !== 'cancelled_refunded').map(deal => (
                      <button 
                        key={deal.id} 
                        onClick={() => setActiveDeal(deal)}
                        className="p-3 border rounded-lg bg-white hover:bg-stone-50 flex items-center justify-between text-left transition-colors shadow-xs"
                      >
                        <div>
                          <p className="font-bold text-xs text-stone-800">{deal.lodgeName} • {deal.roomName}</p>
                          <p className="text-[10px] text-stone-400">Agent: {deal.agentName}</p>
                        </div>
                        <Badge className="text-[9px] font-bold capitalize">{deal.status.replace(/_/g, ' ')}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 1. Location browser */}
              {!selectedLocation && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-stone-800 dark:text-stone-200">Browse Nearby University Towns</h3>
                  {locations.length === 0 ? (
                    <div className="text-center py-20 text-stone-400">No registered university locations found. Please contact administrative support to register sub-regions for {universityCode}.</div>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {locations.map(loc => (
                        <Card key={loc.id} className="overflow-hidden border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-900/60 transition-colors">
                          <div>
                            <img 
                              src={loc.gallery?.[0] || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80'} 
                              alt={loc.name} 
                              referrerPolicy="no-referrer"
                              className="w-full h-44 object-cover" 
                            />
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg font-bold">{loc.name}</CardTitle>
                              <CardDescription>{loc.description.slice(0, 100)}...</CardDescription>
                            </CardHeader>
                          </div>
                          <CardFooter className="flex gap-2 pt-0">
                            <Button variant="outline" size="sm" onClick={() => setInfoModal({ title: loc.name, desc: loc.description, gallery: loc.gallery || [] })} className="flex items-center gap-1.5 flex-1">
                              <Info className="h-3.5 w-3.5" /> See Info
                            </Button>
                            <Button size="sm" onClick={() => setSelectedLocation(loc)} className="flex items-center gap-1 flex-1">
                              Open <ChevronRight className="h-4 w-4" />
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Lodges in a Location */}
              {selectedLocation && !selectedLodge && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLocation(null)}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Towns</Button>
                    <span className="text-stone-300">/</span>
                    <span className="font-bold text-stone-800 dark:text-stone-200">{selectedLocation.name}</span>
                  </div>

                  <h3 className="text-xl font-bold text-stone-800 dark:text-stone-200">Lodges inside {selectedLocation.name}</h3>
                  {lodges.filter(l => l.locationId === selectedLocation.id).length === 0 ? (
                    <div className="text-center py-20 text-stone-400">No registered lodges found inside this sub-region.</div>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {lodges.filter(l => l.locationId === selectedLocation.id).map(ldg => (
                        <Card key={ldg.id} className="overflow-hidden border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-900/60 transition-all">
                          <div>
                            <img 
                              src={ldg.gallery?.[0] || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'} 
                              alt={ldg.name} 
                              referrerPolicy="no-referrer"
                              className="w-full h-44 object-cover" 
                            />
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg font-bold">{ldg.name}</CardTitle>
                              <CardDescription>{ldg.description.slice(0, 100)}...</CardDescription>
                            </CardHeader>
                          </div>
                          <CardFooter className="flex gap-2 pt-0">
                            <Button variant="outline" size="sm" onClick={() => setInfoModal({ title: ldg.name, desc: ldg.description, gallery: ldg.gallery || [] })} className="flex items-center gap-1.5 flex-1">
                              <Info className="h-3.5 w-3.5" /> See Info
                            </Button>
                            <Button size="sm" onClick={() => setSelectedLodge(ldg)} className="flex items-center gap-1 flex-1">
                              See Rooms <ChevronRight className="h-4 w-4" />
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Rooms in a Lodge */}
              {selectedLocation && selectedLodge && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap text-sm text-stone-500">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLocation(null)}>Towns</Button>
                    <span>/</span>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLodge(null)}>{selectedLocation.name}</Button>
                    <span>/</span>
                    <span className="font-bold text-stone-800 dark:text-stone-200">{selectedLodge.name}</span>
                  </div>

                  <h3 className="text-xl font-bold text-stone-800 dark:text-stone-200 font-sans tracking-tight">Available Rooms in {selectedLodge.name}</h3>
                  {rooms.filter(r => r.lodgeId === selectedLodge.id).length === 0 ? (
                    <div className="text-center py-20 text-stone-400">No rooms listed in this lodge.</div>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {rooms.filter(r => r.lodgeId === selectedLodge.id).map(room => {
                        const isRentable = room.status === 'available';
                        const isMyTalk = room.status === 'in talks' && room.inTalksWith === profile?.uid;
                        
                        // Find deal associated with room
                        const deal = studentDeals.find(d => d.roomId === room.id && d.status !== 'completed' && d.status !== 'cancelled_refunded');

                        return (
                          <Card key={room.id} className="overflow-hidden border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-900/60 transition-all">
                            <div>
                              <div className="relative">
                                <img 
                                  src={room.photoUrl} 
                                  alt="Room thumbnail" 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-48 object-cover" 
                                />
                                {room.videoUrl && (
                                  <a 
                                    href={room.videoUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="absolute bottom-3 right-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2 flex items-center justify-center shadow-md transition-colors"
                                  >
                                    <Play className="h-4 w-4 fill-white" />
                                  </a>
                                )}
                              </div>
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-2">
                                  <CardTitle className="text-lg font-bold">{room.name}</CardTitle>
                                  <Badge className={
                                    room.status === 'available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                    room.status === 'in talks' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400' :
                                    'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300'
                                  } variant="outline">
                                    {room.status.toUpperCase()}
                                  </Badge>
                                </div>
                                <span className="text-xl font-black text-indigo-600">₦{room.price.toLocaleString()} / year</span>
                                <p className="text-xs text-stone-500 mt-1 whitespace-pre-wrap">{room.description}</p>
                              </CardHeader>
                            </div>
                            
                            <CardFooter className="pt-2">
                              {isRentable && (
                                <Button className="w-full flex items-center justify-center gap-1.5 font-bold" onClick={() => handleRentRoom(room)}>
                                  <Building className="h-4 w-4" /> Rent Room
                                </Button>
                              )}

                              {isMyTalk && deal && (
                                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 font-bold" onClick={() => setActiveDeal(deal)}>
                                  <MessageSquare className="h-4 w-4" /> Chat (Active Talks)
                                </Button>
                              )}

                              {room.status === 'in talks' && !isMyTalk && (
                                <Button disabled className="w-full">
                                  Room in talks
                                </Button>
                              )}

                              {room.status === 'rented' && (
                                <Button disabled className="w-full" variant="outline">
                                  Rented Out
                                </Button>
                              )}
                            </CardFooter>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
