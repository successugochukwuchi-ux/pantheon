import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AlertCircle, CheckCircle, Database, Shield, User, LogIn, LogOut, RefreshCw } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

export default function Diagnostic() {
  const [results, setResults] = useState<{
    read: { status: 'pending' | 'success' | 'error', message: string, raw?: string };
    write: { status: 'pending' | 'success' | 'error', message: string, raw?: string };
    config: any;
    user: any;
    isChecking: boolean;
  }>({
    read: { status: 'pending', message: 'Testing read...' },
    write: { status: 'pending', message: 'Testing write...' },
    config: firebaseConfig,
    user: null,
    isChecking: false
  });

  const runTests = async () => {
    setResults(prev => ({ ...prev, isChecking: true }));
    const newResults = { ...results };
    
    newResults.user = auth.currentUser ? {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      emailVerified: auth.currentUser.emailVerified
    } : 'Not logged in';

    // Test Read
    try {
      console.log("Diagnostic: Attempting read of system/config...");
      const docRef = doc(db, 'system', 'config');
      const snap = await getDoc(docRef);
      newResults.read = { 
        status: 'success', 
        message: snap.exists() ? 'Read successful: Data found' : 'Read successful: Doc missing but access granted' 
      };
    } catch (err: any) {
      console.error("Diagnostic Read Error:", err);
      newResults.read = { status: 'error', message: `${err.code || 'Error'}: ${err.message}` };
    }

    // Test Write
    try {
      const diagRef = doc(db, 'diagnostics', 'test-doc');
      console.log(`Diagnostic: Attempting write to diagnostics/test-doc...`);
      await setDoc(diagRef, {
        timestamp: new Date().toISOString(),
        userId: auth.currentUser?.uid || 'anonymous',
        note: 'This is a diagnostic write test'
      }, { merge: true });
      newResults.write = { status: 'success', message: `Write successful to diagnostics/test-doc` };
    } catch (err: any) {
      console.error("Diagnostic Write Error Details:", {
        code: err.code,
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      newResults.write = { 
        status: 'error', 
        message: `${err.code || 'Error'}: ${err.message}`,
        raw: JSON.stringify({
          code: err.code,
          message: err.message,
          cause: err.cause,
          serverResponse: err.serverResponse
        }, null, 2)
      };
    }

    setResults({ ...newResults, isChecking: false });
  };

  useEffect(() => {
    runTests();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Logged in successfully");
      runTests();
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        toast.error("Domain Unauthorized", {
          description: "This URL needs to be added to your Firebase Authorized Domains.",
          duration: 10000
        });
      } else {
        toast.error(`Login failed: ${err.message}`);
      }
    }
  };

  const domain = window.location.hostname;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out");
      runTests();
    } catch (err: any) {
      toast.error(`Logout failed: ${err.message}`);
    }
  };

  const handleAnonymousLogin = async () => {
    try {
      await signInAnonymously(auth);
      toast.success("Logged in anonymously");
      runTests();
    } catch (err: any) {
      toast.error(`Anonymous login failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="h-8 w-8 text-primary" />
          Firebase Diagnostic
        </h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={runTests} 
          disabled={results.isChecking}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${results.isChecking ? 'animate-spin' : ''}`} />
          Re-test
        </Button>
      </div>

      {results.user === 'Not logged in' && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Auth Required for Writes</AlertTitle>
          <AlertDescription className="text-xs">
            Your project likely blocks anonymous writes. Please use the login button above.
            If you get <strong>auth/unauthorized-domain</strong>, add this to Firebase Console &gt; Auth &gt; Settings &gt; Authorized Domains:
            <div className="mt-2 p-2 bg-background rounded border font-mono select-all">
              {domain}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
          <CardTitle className="text-lg">Environment & Auth</CardTitle>
          {auth.currentUser ? (
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive gap-2">
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleLogin} className="gap-2">
                <LogIn className="h-4 w-4" /> Google Login
              </Button>
              <Button variant="outline" size="sm" onClick={handleAnonymousLogin} className="gap-2">
                <User className="h-4 w-4" /> Try Anonymous
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase">Project ID</p>
              <p className="font-mono text-sm">{results.config.projectId}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase">Database ID</p>
              <p className="font-mono text-sm">{results.config.firestoreDatabaseId || '(default)'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase">API Key (Ends with)</p>
              <p className="font-mono text-sm">...{results.config.apiKey?.slice(-6)}</p>
            </div>
          </div>
          <div className="space-y-1 border-t pt-4">
            <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
              <User className="h-3 w-3" /> Auth Status: {auth.currentUser ? <Badge variant="default" className="bg-green-500">Authenticated</Badge> : <Badge variant="secondary">Guest</Badge>}
            </p>
            <pre className="text-[10px] bg-muted p-2 rounded overflow-auto mt-2 max-h-32">
              {JSON.stringify(results.user, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={results.read.status === 'error' ? 'border-destructive/50 bg-destructive/5' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold flex items-center gap-2">
                Firestore Read
              </span>
              {results.read.status === 'success' ? <CheckCircle className="h-5 w-5 text-green-500" /> : 
               results.read.status === 'error' ? <AlertCircle className="h-5 w-5 text-destructive" /> : 
               <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />}
            </div>
            <p className="text-xs text-muted-foreground break-all">{results.read.message}</p>
          </CardContent>
        </Card>

        <Card className={results.write.status === 'error' ? 'border-destructive/50 bg-destructive/5' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold flex items-center gap-2">
                Firestore Write
              </span>
              <div className="flex items-center gap-2">
                {results.write.status === 'error' && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                    const el = document.createElement('textarea');
                    el.value = results.write.raw || results.write.message;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                    toast.success("Error copied");
                  }}>
                    <Badge variant="outline" className="text-[8px] cursor-pointer">Copy Raw</Badge>
                  </Button>
                )}
                {results.write.status === 'success' ? <CheckCircle className="h-5 w-5 text-green-500" /> : 
                 results.write.status === 'error' ? <AlertCircle className="h-5 w-5 text-destructive" /> : 
                 <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />}
              </div>
            </div>
            <p className="text-xs text-muted-foreground break-all">{results.write.message}</p>
            {results.write.status === 'error' && results.write.raw && (
              <pre className="text-[8px] bg-red-100/50 p-1 rounded mt-2 overflow-auto max-h-20 font-mono text-red-900 border border-red-200">
                {results.write.raw}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-500/50 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-700 flex items-center gap-2">
            <Shield className="h-5 w-5" /> Troubleshooting "Permission Denied"
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-blue-900">
          <p>If Project/Database IDs are correct and rules are "if true", but you still get 403 errors:</p>
          <ul className="list-disc pl-5 space-y-2">
      <li><strong>The "Invisible" Service Agent:</strong> In Google Cloud IAM, check for a user that looks like <code>service-956262652054@gcp-sa-firestore.iam.gserviceaccount.com</code>. This is the "System Agent" that executes your rules. If it doesn't have <strong>Cloud Datastore Service Agent</strong>, your rules will fail to grant permission.</li>
      <li><strong>Project Plan Quota:</strong> You are on the Spark (Free) plan. Check if you have hit the 20,000 writes/day limit.</li>
            <li><strong>Propagation:</strong> Rules can take up to 2-3 minutes to sync globally. If you just updated them, wait a moment.</li>
            <li><strong>Network/VPN:</strong> Corporate networks or VPNs can sometimes strip headers, causing the Firebase SDK to fail authentication checks.</li>
          </ul>
        </CardContent>
      </Card>

      { (results.read.status === 'error' || results.write.status === 'error') && (
        <Card className="border-amber-500/50 bg-amber-50">
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-amber-700">
              <Shield className="h-5 w-5" />
              Critical Access Warning
            </h3>
            <p className="text-sm text-amber-800">
              Your connection is hitting <strong>{results.config.projectId}</strong>. 
              If the rules are set to "if true" but you still see "Insufficient permissions", 
              it means either the rules did not sync to the cloud yet, or your browser is 
              using a cached/blocked connection channel.
            </p>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Force Refresh</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
