import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  deleteDoc, 
  query, 
  orderBy,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { 
  Smartphone, 
  Copy, 
  Check, 
  Globe, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Radio, 
  Sparkles,
  Link as LinkIcon,
  Upload,
  Loader2,
  Info,
  Github,
  Key,
  ExternalLink,
  Pencil,
  X
} from 'lucide-react';
import { sha256 } from '../lib/crypto';

export interface AppVersionRecord {
  id: string;
  versionNumber: string;
  secretPhrase: string;
  avuuid: string;
  changelog: string;
  isMandatory: boolean;
  hostMode: 'colearn' | 'playstore';
  downloadUrl: string;
  playStoreUrl: string;
  appStoreUrl: string;
  isActive: boolean;
  createdAt: string;
}

// --- IndexedDB Persistence Helpers for GitHub PAT ---
const IDB_NAME = 'ColearnAdminStorage';
const IDB_STORE = 'settings';

async function getPatFromIDB(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          resolve(localStorage.getItem('@colearn_gh_pat') || '');
          return;
        }
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get('gh_pat');
        req.onsuccess = () => resolve(req.result || localStorage.getItem('@colearn_gh_pat') || '');
        req.onerror = () => resolve(localStorage.getItem('@colearn_gh_pat') || '');
      };
      request.onerror = () => resolve(localStorage.getItem('@colearn_gh_pat') || '');
    } catch {
      resolve(localStorage.getItem('@colearn_gh_pat') || '');
    }
  });
}

async function savePatToIDB(pat: string): Promise<void> {
  localStorage.setItem('@colearn_gh_pat', pat);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          resolve();
          return;
        }
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put(pat, 'gh_pat');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export default function AdminMobileControl() {
  const [versions, setVersions] = useState<AppVersionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDoc, setActiveDoc] = useState<any | null>(null);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);
  const [copiedPat, setCopiedPat] = useState(false);

  // New Version Form State
  const [versionNumber, setVersionNumber] = useState('0.1.6');
  const [secretPhrase, setSecretPhrase] = useState('colearn-v0.1.6-release');
  const [computedAvuuid, setComputedAvuuid] = useState('');
  const [changelog, setChangelog] = useState('- Native Edge TTS Audio Chunking\n- Fixed Expo Speech fallbacks\n- Improved Offline CBT Syncing\n- Internal Bug Fixes');
  const [isMandatory, setIsMandatory] = useState(false);
  const [hostMode, setHostMode] = useState<'colearn' | 'playstore'>('colearn');
  const [downloadUrl, setDownloadUrl] = useState('https://colearn-backend-tzo9.onrender.com/downloads/colearn-latest.apk');
  const [playStoreUrl, setPlayStoreUrl] = useState('https://play.google.com/store/apps/details?id=com.pillara.colearn');
  const [appStoreUrl, setAppStoreUrl] = useState('https://apps.apple.com/app/colearn/id123456789');
  const [setActiveImmediately, setSetActiveImmediately] = useState(true);

  // GitHub Releases Upload State
  const [ghOwner, setGhOwner] = useState(() => localStorage.getItem('@colearn_gh_owner') || 'successugochukwuchi-ux');
  const [ghRepo, setGhRepo] = useState(() => localStorage.getItem('@colearn_gh_repo') || 'colearn-mobile');
  const [ghPat, setGhPat] = useState(() => localStorage.getItem('@colearn_gh_pat') || '');
  const [ghUploading, setGhUploading] = useState(false);
  const [ghUploadProgress, setGhUploadProgress] = useState(0);
  const [ghStatusText, setGhStatusText] = useState('');

  // Editing Version Modal State
  const [editingVersion, setEditingVersion] = useState<AppVersionRecord | null>(null);
  const [editVersionNumber, setEditVersionNumber] = useState('');
  const [editSecretPhrase, setEditSecretPhrase] = useState('');
  const [editComputedAvuuid, setEditComputedAvuuid] = useState('');
  const [editChangelog, setEditChangelog] = useState('');
  const [editIsMandatory, setEditIsMandatory] = useState(false);
  const [editHostMode, setEditHostMode] = useState<'colearn' | 'playstore'>('colearn');
  const [editDownloadUrl, setEditDownloadUrl] = useState('');
  const [editPlayStoreUrl, setEditPlayStoreUrl] = useState('');
  const [editAppStoreUrl, setEditAppStoreUrl] = useState('');
  const [editIsActive, setEditIsActive] = useState(false);

  // Load PAT from IndexedDB on startup
  useEffect(() => {
    getPatFromIDB().then((storedPat) => {
      if (storedPat && !ghPat) {
        setGhPat(storedPat);
      }
    });
  }, []);

  // Persist Credentials on change
  useEffect(() => {
    if (ghOwner) localStorage.setItem('@colearn_gh_owner', ghOwner);
    if (ghRepo) localStorage.setItem('@colearn_gh_repo', ghRepo);
    if (ghPat) {
      savePatToIDB(ghPat);
    }
  }, [ghOwner, ghRepo, ghPat]);

  // Compute SHA-256 hash automatically when secretPhrase changes
  useEffect(() => {
    let isMounted = true;
    if (secretPhrase.trim()) {
      sha256(secretPhrase).then((hash) => {
        if (isMounted) setComputedAvuuid(hash);
      });
    } else {
      setComputedAvuuid('');
    }
    return () => { isMounted = false; };
  }, [secretPhrase]);

  // Compute Edit Modal SHA-256 hash
  useEffect(() => {
    let isMounted = true;
    if (editSecretPhrase.trim()) {
      sha256(editSecretPhrase).then((hash) => {
        if (isMounted) setEditComputedAvuuid(hash);
      });
    } else {
      setEditComputedAvuuid('');
    }
    return () => { isMounted = false; };
  }, [editSecretPhrase]);

  // Real-time listener for app_versions and system/mobile
  useEffect(() => {
    const q = query(collection(db, 'app_versions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppVersionRecord));
      setVersions(docs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'app_versions');
    });

    const unsubSystem = onSnapshot(doc(db, 'system', 'mobile'), (snap) => {
      if (snap.exists()) {
        setActiveDoc(snap.data());
      }
    });

    return () => {
      unsub();
      unsubSystem();
    };
  }, []);

  const handleCopyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id);
    toast.success('SHA-256 avuuid copied to clipboard!');
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  const handleCopyPat = () => {
    if (!ghPat.trim()) {
      toast.error('No PAT token entered to copy.');
      return;
    }
    navigator.clipboard.writeText(ghPat.trim());
    setCopiedPat(true);
    toast.success('GitHub Personal Access Token (PAT) copied to clipboard! Share with Overseers.');
    setTimeout(() => setCopiedPat(false), 2000);
  };

  // Direct Browser-to-GitHub Release CDN Upload (Bypasses server body size limits)
  const uploadApkToGitHub = async (
    file: File, 
    targetVer: string, 
    onSuccessUrl: (url: string) => void
  ) => {
    if (!file) return;

    if (!ghPat.trim()) {
      console.error('[GitHub Upload ERROR] No Personal Access Token provided.');
      toast.error('Please enter your GitHub Personal Access Token (PAT) first.');
      return;
    }
    if (!ghOwner.trim() || !ghRepo.trim()) {
      console.error('[GitHub Upload ERROR] Missing owner or repo:', { ghOwner, ghRepo });
      toast.error('Please enter your GitHub Owner and Repository name.');
      return;
    }

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const tagName = `v${targetVer.trim() || '0.1.6'}`;
    const cleanToken = ghPat.trim();
    const cleanOwner = ghOwner.trim();
    const cleanRepo = ghRepo.trim();
    const assetFileName = file.name.endsWith('.apk') ? file.name : `colearn-${tagName}.apk`;

    console.log('[GitHub Upload INIT - DIRECT BROWSER UPLOAD]', {
      owner: cleanOwner,
      repo: cleanRepo,
      tag: tagName,
      fileName: assetFileName,
      fileSizeMB: sizeMB,
      tokenPrefix: cleanToken.substring(0, 6) + '...'
    });

    // Save PAT to IndexedDB
    savePatToIDB(cleanToken);

    setGhUploading(true);
    setGhUploadProgress(0);
    setGhStatusText(`Connecting to GitHub API for ${cleanOwner}/${cleanRepo}...`);

    try {
      // 1. Fetch release info directly from GitHub API
      const getReleaseUrl = `https://api.github.com/repos/${cleanOwner}/${cleanRepo}/releases/tags/${tagName}`;
      console.log(`[GitHub Upload] 1. Checking tag ${tagName} at ${getReleaseUrl}`);

      let releaseRes = await fetch(getReleaseUrl, {
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Accept': 'application/vnd.github+json',
        }
      });

      let release: any;

      if (releaseRes.ok) {
        release = await releaseRes.json();
        console.log(`[GitHub Upload] Found existing release ID ${release.id} for tag ${tagName}`);
        setGhStatusText(`Found release ${tagName}. Checking existing assets...`);
      } else if (releaseRes.status === 404) {
        console.log(`[GitHub Upload] Release tag ${tagName} not found. Creating new release on GitHub...`);
        setGhStatusText(`Creating release ${tagName} on GitHub...`);

        const createRes = await fetch(`https://api.github.com/repos/${cleanOwner}/${cleanRepo}/releases`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tag_name: tagName,
            name: `CoLearn Mobile ${tagName}`,
            body: `CoLearn Mobile Release ${tagName}`,
            draft: false,
            prerelease: false,
          })
        });

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          console.error(`[GitHub Upload ERROR] Failed to create GitHub release (${createRes.status}):`, errData);
          throw new Error(errData.message || `Failed to create release on GitHub (${createRes.status}). Verify PAT repository permissions.`);
        }

        release = await createRes.json();
        console.log(`[GitHub Upload] Created new release ID ${release.id} for tag ${tagName}`);
      } else {
        const errData = await releaseRes.json().catch(() => ({}));
        console.error(`[GitHub Upload ERROR] GitHub API returned status ${releaseRes.status}:`, errData);
        throw new Error(errData.message || `GitHub API error (${releaseRes.status}). Verify your Personal Access Token.`);
      }

      if (!release || !release.upload_url) {
        throw new Error('Invalid release payload received from GitHub API.');
      }

      // 2. Remove existing asset if it matches the filename to prevent 422 Conflict
      if (release.assets && Array.isArray(release.assets)) {
        const existingAsset = release.assets.find((a: any) => a.name === assetFileName);
        if (existingAsset) {
          console.log(`[GitHub Upload] Removing existing asset ID ${existingAsset.id} (${assetFileName})...`);
          setGhStatusText(`Replacing existing asset ${assetFileName}...`);
          await fetch(`https://api.github.com/repos/${cleanOwner}/${cleanRepo}/releases/assets/${existingAsset.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${cleanToken}`,
              'Accept': 'application/vnd.github+json',
            }
          });
        }
      }

      // 3. Set the standard GitHub CDN URL immediately so it's ready to use
      const expectedCdnUrl = `https://github.com/${cleanOwner}/${cleanRepo}/releases/download/${tagName}/${assetFileName}`;
      const releasePageUrl = `https://github.com/${cleanOwner}/${cleanRepo}/releases/edit/${tagName}`;
      
      console.log(`[GitHub Upload] Setting expected CDN URL: ${expectedCdnUrl}`);
      onSuccessUrl(expectedCdnUrl);

      // 4. Attempt direct browser upload via XHR
      const baseUrl = release.upload_url.replace(/\{.*?\}/, '');
      const uploadEndpoint = `${baseUrl}?name=${encodeURIComponent(assetFileName)}`;

      console.log(`[GitHub Upload] 4. Streaming binary to GitHub CDN endpoint: ${uploadEndpoint}`);
      setGhStatusText(`Uploading ${assetFileName} (${sizeMB} MB) to GitHub CDN...`);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadEndpoint, true);
      xhr.setRequestHeader('Authorization', `Bearer ${cleanToken}`);
      xhr.setRequestHeader('Accept', 'application/vnd.github+json');
      xhr.setRequestHeader('Content-Type', 'application/vnd.android.package-archive');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setGhUploadProgress(percent);
          setGhStatusText(`Uploading APK... ${percent}% (${(event.loaded / (1024 * 1024)).toFixed(1)} / ${sizeMB} MB)`);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const assetRes = JSON.parse(xhr.responseText);
            const finalUrl = assetRes.browser_download_url || expectedCdnUrl;
            onSuccessUrl(finalUrl);
            toast.success(`APK (${sizeMB} MB) uploaded to GitHub Release ${tagName}! Permanent CDN URL set.`);
          } catch {
            toast.success(`APK uploaded to GitHub Release ${tagName}!`);
          }
        } else {
          console.warn(`[GitHub Upload direct upload HTTP ${xhr.status}]. Opening 1-click release uploader page...`);
          toast.info(`Release ${tagName} created! Opening GitHub Release page to drop ${assetFileName}...`);
          window.open(releasePageUrl, '_blank');
        }
        setGhUploading(false);
      };

      xhr.onerror = (evt) => {
        console.warn('[GitHub Upload CORS/XHR restriction]. Release tag created! Opening 1-click GitHub Release editor...', evt);
        toast.success(`Release tag ${tagName} created on GitHub! Direct CDN download URL is ready.`);
        toast.info(`Opening GitHub Release page in new tab to attach ${assetFileName} file...`);
        window.open(releasePageUrl, '_blank');
        setGhUploading(false);
      };

      xhr.send(file);

    } catch (err: any) {
      console.error('[GitHub Upload Exception]:', err);
      toast.error(err.message || 'GitHub Release upload failed.');
      setGhUploading(false);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionNumber.trim()) {
      toast.error('Version number is required');
      return;
    }
    if (!secretPhrase.trim()) {
      toast.error('Version secret phrase is required');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Creating new release version...');
    try {
      const hash = computedAvuuid || (await sha256(secretPhrase));
      const nowIso = new Date().toISOString();

      const batch = writeBatch(db);

      if (setActiveImmediately) {
        versions.forEach(v => {
          if (v.isActive) {
            batch.update(doc(db, 'app_versions', v.id), { isActive: false });
          }
        });
      }

      const versionRef = doc(collection(db, 'app_versions'));
      const versionData: Omit<AppVersionRecord, 'id'> = {
        versionNumber: versionNumber.trim(),
        secretPhrase: secretPhrase.trim(),
        avuuid: hash,
        changelog: changelog.trim(),
        isMandatory,
        hostMode,
        downloadUrl: downloadUrl.trim(),
        playStoreUrl: playStoreUrl.trim(),
        appStoreUrl: appStoreUrl.trim(),
        isActive: setActiveImmediately,
        createdAt: nowIso,
      };

      batch.set(versionRef, versionData);

      if (setActiveImmediately) {
        batch.set(doc(db, 'system', 'mobile'), {
          activeVersionId: versionRef.id,
          versionNumber: versionNumber.trim(),
          secretPhrase: secretPhrase.trim(),
          avuuid: hash,
          changelog: changelog.trim(),
          isMandatory,
          hostMode,
          downloadUrl: downloadUrl.trim(),
          playStoreUrl: playStoreUrl.trim(),
          appStoreUrl: appStoreUrl.trim(),
          updatedAt: nowIso,
        });
      }

      await batch.commit();

      toast.success(`Version ${versionNumber} created and published!`, { id: toastId });

      const parts = versionNumber.split('.');
      if (parts.length === 3) {
        const lastPart = parseInt(parts[2], 10);
        if (!isNaN(lastPart)) {
          const nextVersion = `${parts[0]}.${parts[1]}.${lastPart + 1}`;
          setVersionNumber(nextVersion);
          setSecretPhrase(`colearn-v${nextVersion}-release`);
        }
      }
    } catch (err: any) {
      toast.error(`Failed to create version: ${err.message}`, { id: toastId });
      handleFirestoreError(err, OperationType.WRITE, 'app_versions');
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (version: AppVersionRecord) => {
    setLoading(true);
    const toastId = toast.loading(`Publishing v${version.versionNumber} as active version...`);
    try {
      const batch = writeBatch(db);

      versions.forEach(v => {
        batch.update(doc(db, 'app_versions', v.id), { isActive: v.id === version.id });
      });

      batch.set(doc(db, 'system', 'mobile'), {
        activeVersionId: version.id,
        versionNumber: version.versionNumber,
        secretPhrase: version.secretPhrase,
        avuuid: version.avuuid,
        changelog: version.changelog,
        isMandatory: version.isMandatory,
        hostMode: version.hostMode,
        downloadUrl: version.downloadUrl,
        playStoreUrl: version.playStoreUrl,
        appStoreUrl: version.appStoreUrl,
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();
      toast.success(`Active version updated to v${version.versionNumber}`, { id: toastId });
    } catch (err: any) {
      toast.error(`Failed to switch active version: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVersion = async (e: React.MouseEvent, version: AppVersionRecord) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete version v${version.versionNumber}?`)) return;

    try {
      await deleteDoc(doc(db, 'app_versions', version.id));
      toast.success(`Version v${version.versionNumber} deleted.`);

      if (version.isActive) {
        toast.info('The deleted version was active. Setting the newest remaining version as active...');
        const remaining = versions.filter(v => v.id !== version.id);
        if (remaining.length > 0) {
          handleSetActive(remaining[0]);
        }
      }
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
      handleFirestoreError(err, OperationType.DELETE, `app_versions/${version.id}`);
    }
  };

  const handleOpenEditModal = (e: React.MouseEvent, ver: AppVersionRecord) => {
    e.stopPropagation();
    setEditingVersion(ver);
    setEditVersionNumber(ver.versionNumber);
    setEditSecretPhrase(ver.secretPhrase || `colearn-v${ver.versionNumber}-release`);
    setEditChangelog(ver.changelog || '');
    setEditIsMandatory(ver.isMandatory || false);
    setEditHostMode(ver.hostMode || 'colearn');
    setEditDownloadUrl(ver.downloadUrl || '');
    setEditPlayStoreUrl(ver.playStoreUrl || '');
    setEditAppStoreUrl(ver.appStoreUrl || '');
    setEditIsActive(ver.isActive || false);
  };

  const handleSaveEditVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVersion) return;

    if (!editVersionNumber.trim()) {
      toast.error('Version number is required');
      return;
    }

    setLoading(true);
    const toastId = toast.loading(`Updating version v${editVersionNumber}...`);

    try {
      const hash = editComputedAvuuid || (await sha256(editSecretPhrase));
      const nowIso = new Date().toISOString();

      const batch = writeBatch(db);

      // If active state changed to true, deactivate others
      if (editIsActive && !editingVersion.isActive) {
        versions.forEach(v => {
          if (v.id !== editingVersion.id && v.isActive) {
            batch.update(doc(db, 'app_versions', v.id), { isActive: false });
          }
        });
      }

      const versionRef = doc(db, 'app_versions', editingVersion.id);
      const updatePayload = {
        versionNumber: editVersionNumber.trim(),
        secretPhrase: editSecretPhrase.trim(),
        avuuid: hash,
        changelog: editChangelog.trim(),
        isMandatory: editIsMandatory,
        hostMode: editHostMode,
        downloadUrl: editDownloadUrl.trim(),
        playStoreUrl: editPlayStoreUrl.trim(),
        appStoreUrl: editAppStoreUrl.trim(),
        isActive: editIsActive,
        updatedAt: nowIso,
      };

      batch.update(versionRef, updatePayload);

      if (editIsActive) {
        batch.set(doc(db, 'system', 'mobile'), {
          activeVersionId: editingVersion.id,
          ...updatePayload,
        });
      }

      await batch.commit();

      toast.success(`Version v${editVersionNumber} updated successfully!`, { id: toastId });
      setEditingVersion(null);
    } catch (err: any) {
      toast.error(`Failed to update version: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 border border-stone-800 rounded-2xl shadow-xl text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-emerald-400" />
            <h2 className="text-2xl font-bold tracking-tight">Mobile Client Control</h2>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Level 5 Overseer</Badge>
          </div>
          <p className="text-stone-400 text-sm">
            Manage mobile app versioning, secret phrases, SHA-256 hashes (`avuuid`), in-app self updates, and GitHub Release CDN downloads.
          </p>
        </div>
        {activeDoc && (
          <div className="bg-stone-950/80 border border-stone-700/50 p-3 rounded-xl flex items-center gap-3">
            <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            <div className="text-xs">
              <div className="text-stone-400 font-medium">Currently Active Mobile Build</div>
              <div className="font-mono font-bold text-emerald-400">
                v{activeDoc.versionNumber} ({activeDoc.hostMode === 'playstore' ? 'Play Store' : 'Colearn Direct'})
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Version Creation Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Publish New App Version
              </CardTitle>
              <CardDescription>
                Create a version record, generate the SHA-256 hash (`avuuid`), and upload APK assets to GitHub Release CDN.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateVersion}>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vNum">Version Number</Label>
                    <Input 
                      id="vNum"
                      value={versionNumber} 
                      onChange={(e) => setVersionNumber(e.target.value)} 
                      placeholder="e.g. 0.1.6" 
                      required 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hMode">Host Mode</Label>
                    <Select value={hostMode} onValueChange={(val: any) => setHostMode(val)}>
                      <SelectTrigger id="hMode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="colearn">Colearn Direct (APK In-App Downloader)</SelectItem>
                        <SelectItem value="playstore">Play Store Redirect</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Secret Phrase & Computed Hash */}
                <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-muted">
                  <div className="space-y-1">
                    <Label htmlFor="sPhrase" className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Version Secret Phrase (Generates SHA-256 avuuid)
                    </Label>
                    <Input 
                      id="sPhrase"
                      value={secretPhrase} 
                      onChange={(e) => setSecretPhrase(e.target.value)} 
                      placeholder="Enter a secret phrase..." 
                      className="font-mono text-sm"
                      required 
                    />
                  </div>

                  {computedAvuuid && (
                    <div className="space-y-1 pt-2 border-t">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                        Computed SHA-256 Hash (`avuuid`)
                      </Label>
                      <div className="flex items-center justify-between gap-2 bg-background p-2.5 rounded-lg border font-mono text-xs text-primary font-bold break-all">
                        <span>{computedAvuuid}</span>
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 shrink-0 text-xs gap-1"
                          onClick={() => handleCopyHash(computedAvuuid, 'form')}
                        >
                          {copiedHashId === 'form' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedHashId === 'form' ? 'Copied' : 'Copy Hash'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* GitHub Direct Releases Uploader */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-primary" />
                    Download & Store Links
                  </h4>

                  {hostMode === 'colearn' && (
                    <div className="p-4 rounded-xl border border-sky-500/40 bg-sky-950/10 dark:bg-sky-950/30 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold flex items-center gap-2 text-sky-600 dark:text-sky-400">
                            <Github className="h-4 w-4 text-sky-500" />
                            Upload APK to GitHub Release CDN (Unlimited Free Storage)
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Uploads full binary APKs directly to GitHub Release assets using your Personal Access Token (PAT).
                          </p>
                        </div>
                        <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px] shrink-0 font-bold">
                          GitHub CDN
                        </Badge>
                      </div>

                      {/* GitHub Credentials Settings */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-background/80 p-3 rounded-lg border border-sky-500/20">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">GitHub Username / Org</Label>
                          <Input 
                            value={ghOwner} 
                            onChange={(e) => setGhOwner(e.target.value)} 
                            placeholder="e.g. successugochukwuchi-ux" 
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">Repository Name</Label>
                          <Input 
                            value={ghRepo} 
                            onChange={(e) => setGhRepo(e.target.value)} 
                            placeholder="e.g. colearn-mobile" 
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                              <Key className="h-3 w-3 text-amber-500" /> PAT Token
                            </Label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-5 px-1.5 text-[10px] text-sky-500 hover:text-sky-400 gap-1"
                                onClick={handleCopyPat}
                                title="Copy PAT to share with other overseers"
                              >
                                {copiedPat ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
                                {copiedPat ? 'Copied' : 'Copy PAT'}
                              </Button>
                              <a 
                                href="https://github.com/settings/tokens/new?scopes=repo&description=CoLearn+Mobile+Release+Uploader" 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[10px] text-sky-500 hover:underline flex items-center gap-0.5"
                              >
                                Generate <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          </div>
                          <Input 
                            type="password"
                            value={ghPat} 
                            onChange={(e) => setGhPat(e.target.value)} 
                            placeholder="ghp_xxxxxxxxxxxx" 
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>

                      {/* GitHub Upload Trigger */}
                      <div className="relative">
                        <input
                          type="file"
                          accept=".apk,application/vnd.android.package-archive,application/octet-stream"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadApkToGitHub(file, versionNumber, (url) => setDownloadUrl(url));
                          }}
                          disabled={ghUploading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                          id="github-apk-file-input"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full flex items-center justify-center gap-2 border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold py-5 relative"
                          disabled={ghUploading}
                        >
                          {ghUploading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                              <span>Uploading to GitHub CDN ({ghUploadProgress}%)</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 text-sky-500" />
                              <span>Select & Upload APK File to GitHub Release ({`v${versionNumber}`})</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {ghUploading && (
                        <div className="space-y-1.5">
                          <div className="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-sky-500 h-2 rounded-full transition-all duration-200" 
                              style={{ width: `${ghUploadProgress}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-sky-600 dark:text-sky-400 font-mono text-center">
                            {ghStatusText}
                          </p>
                        </div>
                      )}

                      {downloadUrl && downloadUrl.includes('github.com') && (
                        <div className="flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400 font-medium bg-background/90 p-2.5 rounded-lg border border-sky-500/30">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-500" />
                          <span className="truncate">GitHub Permanent CDN URL: {downloadUrl}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="apkLink">Android APK Download Link (For Colearn Host Mode)</Label>
                    <Input 
                      id="apkLink"
                      value={downloadUrl} 
                      onChange={(e) => setDownloadUrl(e.target.value)} 
                      placeholder="https://github.com/.../releases/download/.../app.apk" 
                      required={hostMode === 'colearn'}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="playLink">Google Play Store Link (Android)</Label>
                      <Input 
                        id="playLink"
                        value={playStoreUrl} 
                        onChange={(e) => setPlayStoreUrl(e.target.value)} 
                        placeholder="https://play.google.com/store/apps/details?id=..." 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="appLink">Apple App Store Link (iOS)</Label>
                      <Input 
                        id="appLink"
                        value={appStoreUrl} 
                        onChange={(e) => setAppStoreUrl(e.target.value)} 
                        placeholder="https://apps.apple.com/app/id..." 
                      />
                    </div>
                  </div>
                </div>

                {/* Changelog & Options */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cLog">Release Notes / Changelog</Label>
                    <Textarea 
                      id="cLog"
                      value={changelog} 
                      onChange={(e) => setChangelog(e.target.value)} 
                      placeholder="List changes in this release..."
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                      <input 
                        type="checkbox" 
                        id="mandatoryToggle"
                        checked={isMandatory} 
                        onChange={(e) => setIsMandatory(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="mandatoryToggle" className="text-sm font-medium cursor-pointer">
                        <span className="font-bold text-foreground block">Mandatory Update</span>
                        <span className="text-xs text-muted-foreground">User cannot bypass prompt without updating</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                      <input 
                        type="checkbox" 
                        id="activeToggle"
                        checked={setActiveImmediately} 
                        onChange={(e) => setSetActiveImmediately(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="activeToggle" className="text-sm font-medium cursor-pointer">
                        <span className="font-bold text-foreground block">Set as Active Release</span>
                        <span className="text-xs text-muted-foreground">Publish immediately to all mobile clients</span>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end gap-3 border-t pt-4">
                <Button type="submit" disabled={loading} className="gap-2">
                  <Smartphone className="h-4 w-4" />
                  Publish Mobile Release
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Right 1 Col: Active Overview & Release History */}
        <div className="space-y-6">
          {/* Active Config Overview */}
          <Card className="border-emerald-500/30 bg-emerald-950/10 dark:bg-emerald-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Active System Release
                </span>
                {activeDoc && (
                  <Badge className="bg-emerald-500 text-white border-none">LIVE</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {activeDoc ? (
                <>
                  <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2">
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-bold font-mono text-foreground text-base">v{activeDoc.versionNumber}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2">
                    <span className="text-muted-foreground">Host Mode:</span>
                    <Badge variant="outline" className="capitalize">{activeDoc.hostMode}</Badge>
                  </div>
                  <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2">
                    <span className="text-muted-foreground">Mandatory:</span>
                    <span className="font-semibold">{activeDoc.isMandatory ? 'Yes (Blocker)' : 'No (Optional)'}</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <span className="text-xs text-muted-foreground font-bold uppercase">Secret Hash (avuuid):</span>
                    <div className="flex items-center justify-between gap-1 bg-background p-2 rounded border font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 break-all">
                      <span>{activeDoc.avuuid}</span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleCopyHash(activeDoc.avuuid, 'active')}
                      >
                        {copiedHashId === 'active' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">No active version set yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Release History List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Version Release History ({versions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[550px] overflow-y-auto divide-y">
              {versions.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No versions created yet.
                </div>
              ) : (
                versions.map((ver) => (
                  <div key={ver.id} className="p-4 space-y-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-base">v{ver.versionNumber}</span>
                          {ver.isActive && (
                            <Badge className="bg-emerald-500 text-white text-[10px] h-5 py-0">Active</Badge>
                          )}
                          {ver.isMandatory && (
                            <Badge variant="destructive" className="text-[10px] h-5 py-0">Mandatory</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ver.createdAt ? new Date(ver.createdAt).toLocaleString() : ''} • Host: <span className="font-semibold uppercase">{ver.hostMode}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {!ver.isActive && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs font-semibold"
                            onClick={() => handleSetActive(ver)}
                          >
                            Set Active
                          </Button>
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-stone-600 dark:text-stone-300 hover:bg-muted"
                          title="Edit Version Details"
                          onClick={(e) => handleOpenEditModal(e, ver)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Delete Version Record"
                          onClick={(e) => handleDeleteVersion(e, ver)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Hash Display */}
                    <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded text-[11px] font-mono">
                      <span className="truncate text-muted-foreground font-semibold">hash: {ver.avuuid}</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 text-[10px] gap-1 px-2 shrink-0"
                        onClick={() => handleCopyHash(ver.avuuid, ver.id)}
                      >
                        {copiedHashId === ver.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {copiedHashId === ver.id ? 'Copied' : 'Copy'}
                      </Button>
                    </div>

                    {/* Changelog summary */}
                    {ver.changelog && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2 bg-background p-2 rounded border">
                        {ver.changelog}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --- EDIT VERSION MODAL --- */}
      {editingVersion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">Edit Mobile Release Version v{editingVersion.versionNumber}</h3>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full"
                onClick={() => setEditingVersion(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveEditVersion} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Version Number</Label>
                  <Input 
                    value={editVersionNumber} 
                    onChange={(e) => setEditVersionNumber(e.target.value)} 
                    required 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Host Mode</Label>
                  <Select value={editHostMode} onValueChange={(val: any) => setEditHostMode(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colearn">Colearn Direct (APK In-App Downloader)</SelectItem>
                      <SelectItem value="playstore">Play Store Redirect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Secret Phrase & Computed Hash */}
              <div className="space-y-2 bg-muted/40 p-4 rounded-xl border border-muted">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Version Secret Phrase
                </Label>
                <Input 
                  value={editSecretPhrase} 
                  onChange={(e) => setEditSecretPhrase(e.target.value)} 
                  className="font-mono text-xs"
                  required 
                />
                {editComputedAvuuid && (
                  <div className="pt-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Computed Hash:</span>
                    <div className="font-mono text-xs font-bold text-primary break-all bg-background p-2 rounded border mt-1">
                      {editComputedAvuuid}
                    </div>
                  </div>
                )}
              </div>

              {/* Edit GitHub Uploader Option */}
              {editHostMode === 'colearn' && (
                <div className="p-4 rounded-xl border border-sky-500/40 bg-sky-950/10 dark:bg-sky-950/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold flex items-center gap-2 text-sky-600 dark:text-sky-400">
                      <Github className="h-4 w-4" /> Re-upload New APK to GitHub Release ({`v${editVersionNumber}`})
                    </Label>
                  </div>

                  <div className="relative">
                    <input
                      type="file"
                      accept=".apk,application/vnd.android.package-archive,application/octet-stream"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadApkToGitHub(file, editVersionNumber, (url) => setEditDownloadUrl(url));
                      }}
                      disabled={ghUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2 border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold py-4 relative"
                      disabled={ghUploading}
                    >
                      {ghUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                          <span>Uploading ({ghUploadProgress}%)</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-sky-500" />
                          <span>Select & Upload New APK for v{editVersionNumber}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Android APK Download URL</Label>
                <Input 
                  value={editDownloadUrl} 
                  onChange={(e) => setEditDownloadUrl(e.target.value)} 
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Google Play Store Link</Label>
                  <Input 
                    value={editPlayStoreUrl} 
                    onChange={(e) => setEditPlayStoreUrl(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apple App Store Link</Label>
                  <Input 
                    value={editAppStoreUrl} 
                    onChange={(e) => setEditAppStoreUrl(e.target.value)} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Release Notes / Changelog</Label>
                <Textarea 
                  value={editChangelog} 
                  onChange={(e) => setEditChangelog(e.target.value)} 
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                  <input 
                    type="checkbox" 
                    id="editMandatory"
                    checked={editIsMandatory} 
                    onChange={(e) => setEditIsMandatory(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary"
                  />
                  <label htmlFor="editMandatory" className="text-sm font-semibold cursor-pointer">
                    Mandatory Update
                  </label>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                  <input 
                    type="checkbox" 
                    id="editActive"
                    checked={editIsActive} 
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary"
                  />
                  <label htmlFor="editActive" className="text-sm font-semibold cursor-pointer">
                    Set as Currently Active Build
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingVersion(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="gap-2">
                  <Check className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
