import React, { useState } from 'react';
import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
import { Check, Moon, Sun, Palette, Droplets, TreePine, Eye, EyeOff, Settings as SettingsIcon, User, Copy, Upload, Loader2, Camera, Trash2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTitle } from '../hooks/useTitle';

export default function Settings() {
  useTitle('Settings');
  const { user, profile } = useAuth();
  const { theme, setTheme, customColors, setCustomColors } = useTheme();
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarSeed, setAvatarSeed] = useState(profile?.username || user?.uid || 'default');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const avatars = [
    'adventurer',
    'avataaars',
    'big-smile',
    'bottts',
    'croodles',
    'fun-emoji',
    'lorelei',
    'notionists',
    'open-peeps',
    'pixel-art'
  ];

  const [avatarStyle, setAvatarStyle] = useState('avataaars');

  // Profile upload and state synchronization
  const [currentPhotoURL, setCurrentPhotoURL] = useState(profile?.photoURL || user?.photoURL || '');
  const [avatarSource, setAvatarSource] = useState<'dicebear' | 'custom'>(
    profile?.photoURL?.includes('cloudinary') || (profile?.photoURL && !profile.photoURL.includes('dicebear.com'))
      ? 'custom'
      : 'dicebear'
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  React.useEffect(() => {
    if (profile && !hasInitialized) {
      setUsername(profile.username || '');
      
      const photo = profile.photoURL || user?.photoURL || '';
      setCurrentPhotoURL(photo);
      
      const isCurrentlyDicebear = photo.includes('dicebear.com') || !photo;
      const source = (photo.includes('cloudinary') || (photo && !isCurrentlyDicebear)) ? 'custom' : 'dicebear';
      setAvatarSource(source);

      if (isCurrentlyDicebear && photo) {
        const style = photo.split('/7.x/')[1]?.split('/')[0];
        if (style) setAvatarStyle(style);
        
        const seed = photo.split('seed=')[1]?.split('&')[0];
        if (seed) setAvatarSeed(seed);
      }
      setHasInitialized(true);
    }
  }, [profile, user, hasInitialized]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadFile(e.target.files[0]);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!file) return;
    
    // Validation
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG, WEBP, etc.)');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'colodge_unsigned');
      formData.append('folder', 'colodge_listings');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.cloudinary.com/v1_1/lfrjrbtz/upload', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          const secureUrl = response.secure_url;
          setCurrentPhotoURL(secureUrl);
          setAvatarSource('custom');
          setUploading(false);
          toast.success('Photo uploaded successfully! Save your profile to apply.');
        } else {
          let errorMsg = 'Upload failed';
          try {
            const resp = JSON.parse(xhr.responseText);
            if (resp.error?.message) {
              errorMsg = resp.error.message;
            }
          } catch (e) {}
          setUploadError(errorMsg);
          setUploading(false);
          toast.error(errorMsg);
        }
      };

      xhr.onerror = () => {
        setUploadError('Network error occurred during upload.');
        setUploading(false);
        toast.error('Network error during upload.');
      };

      xhr.send(formData);
    } catch (err: any) {
      setUploadError(err.message || 'An unexpected error occurred.');
      setUploading(false);
      toast.error(err.message || 'Upload failed');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().replace(/[^a-zA-Z0-9_]/g, '');
    
    if (cleanUsername.length < 3) {
      toast.error('Username must be at least 3 characters long');
      return;
    }

    setLoading(true);
    try {
      if (user) {
        const photoURL = avatarSource === 'custom' 
          ? currentPhotoURL 
          : `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${avatarSeed}`;
        
        if (!photoURL) {
          toast.error('Please upload a photo or generate an avatar first');
          setLoading(false);
          return;
        }

        await updateProfile(user, { photoURL });
        await updateDoc(doc(db, 'users', user.uid), {
          username: cleanUsername,
          username_lower: cleanUsername.toLowerCase(),
          photoURL: photoURL
        });
        setUsername(cleanUsername);
        toast.success('Profile updated successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    setLoading(true);
    try {
      if (user) {
        await updatePassword(user, newPassword);
        toast.success('Password updated successfully');
        setNewPassword('');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const themes = [
    { id: 'light', name: 'Light', icon: Sun, color: 'bg-white' },
    { id: 'dark', name: 'Dark', icon: Moon, color: 'bg-slate-900' },
    { id: 'sepia', name: 'Sepia', icon: Palette, color: 'bg-[#f4ecd8]' },
    { id: 'ocean', name: 'Ocean', icon: Droplets, color: 'bg-blue-100' },
    { id: 'forest', name: 'Forest', icon: TreePine, color: 'bg-green-100' },
    { id: 'midnight', name: 'Midnight', icon: Moon, color: 'bg-indigo-950' },
    { id: 'sunset', name: 'Sunset', icon: Sun, color: 'bg-orange-100' },
    { id: 'lavender', name: 'Lavender', icon: Palette, color: 'bg-purple-100' },
    { id: 'velvet', name: 'Velvet', icon: Palette, color: 'bg-[#2d0b13] border-red-900 border' },
    { id: 'obsidian', name: 'Obsidian', icon: Moon, color: 'bg-[#08001a] border-purple-900 border' },
    { id: 'custom', name: 'Custom', icon: SettingsIcon, color: 'bg-gradient-to-br from-red-200 via-green-200 to-blue-200' },
  ] as const;

  const handleCustomColorChange = (key: string, value: string) => {
    setCustomColors({ ...customColors, [key]: value });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Profile & Avatar</CardTitle>
            <CardDescription>Update your public profile and choose an avatar.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateProfile}>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Left Column: Avatar Preview and Tab Selector */}
                <div className="flex flex-col items-center gap-4 shrink-0 w-full md:w-auto">
                  <div className="relative group rounded-full overflow-hidden border-4 border-muted shadow-md h-28 w-28 bg-muted flex items-center justify-center shrink-0">
                    <Avatar className="h-full w-full">
                      <AvatarImage 
                        src={avatarSource === 'custom' && currentPhotoURL ? currentPhotoURL : `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${avatarSeed}`} 
                        alt="Profile Preview"
                        className="object-cover"
                      />
                      <AvatarFallback>{username[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <label 
                      htmlFor="avatar-file-input" 
                      className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-white"
                    >
                      <Camera className="h-5 w-5 mb-0.5" />
                      <span className="text-[10px] font-semibold">Upload Photo</span>
                    </label>
                  </div>
                  
                  {/* Source Toggle Bar */}
                  <div className="flex p-0.5 bg-stone-100 dark:bg-stone-900 border rounded-lg w-full max-w-[200px]">
                    <button
                      type="button"
                      onClick={() => setAvatarSource('custom')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold rounded-md transition-all duration-200 ${
                        avatarSource === 'custom'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Camera className="h-3 w-3" />
                      <span>Upload</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarSource('dicebear')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold rounded-md transition-all duration-200 ${
                        avatarSource === 'dicebear'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>AI Avatar</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: Fields and Options */}
                <div className="flex-1 space-y-4 w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        className="font-sans"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input value={user?.email || ''} disabled className="bg-muted font-sans" />
                    </div>
                  </div>
                  
                  {/* Option Content block */}
                  {avatarSource === 'dicebear' ? (
                    <div className="space-y-4 pt-2 border-t border-muted animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="space-y-2">
                        <Label htmlFor="avatarSeed">Avatar Seed</Label>
                        <Input 
                          id="avatarSeed"
                          value={avatarSeed} 
                          onChange={(e) => setAvatarSeed(e.target.value)}
                          placeholder="Enter any text to generate unique avatars..."
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Avatar Style</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          {avatars.map(style => (
                            <Button 
                              key={style}
                              type="button"
                              variant={avatarStyle === style ? 'default' : 'outline'}
                              size="sm"
                              className="text-[10px] h-8 px-1 truncate capitalize"
                              onClick={() => setAvatarStyle(style)}
                            >
                              {style.replace('-', ' ')}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2 border-t border-muted animate-in fade-in slide-in-from-top-1 duration-200">
                      <Label>Custom Profile Image</Label>
                      
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`relative border-2 border-dashed rounded-xl p-5 transition-all duration-300 flex flex-col items-center justify-center text-center ${
                          dragActive
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/20 hover:border-muted-foreground/40 bg-muted/5'
                        }`}
                      >
                        <input
                          type="file"
                          id="avatar-file-input"
                          accept="image/*"
                          onChange={handleFileInputChange}
                          disabled={uploading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                        />
                        
                        <div className="p-2.5 bg-background border rounded-full shadow-sm mb-2.5 text-muted-foreground">
                          {uploading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : (
                            <Upload className="h-5 w-5" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-semibold">
                            {uploading ? `Uploading image... (${uploadProgress}%)` : 'Drag & drop image or click to choose'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Accepts JPEG, PNG, WEBP, GIF up to 5MB
                          </p>
                        </div>

                        {uploading && (
                          <div className="w-full max-w-[240px] mt-3">
                            <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                              <div
                                className="bg-primary h-1 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {uploadError && (
                        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{uploadError}</span>
                        </div>
                      )}

                      {currentPhotoURL && !currentPhotoURL.includes('dicebear') && (
                        <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/10 rounded-xl border border-emerald-100 dark:border-emerald-950/20 animate-in fade-in duration-300">
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-full border overflow-hidden shrink-0 bg-background">
                              <img src={currentPhotoURL} alt="Profile preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div className="text-left">
                              <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                Custom Picture Active
                              </p>
                              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">Save profile changes to finalize</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive h-7 px-2 text-[10px]"
                            onClick={() => {
                              setCurrentPhotoURL('');
                              setAvatarSource('dicebear');
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loading}>Save Profile Changes</Button>
            </CardFooter>
          </form>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdatePassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input 
                    id="new-password" 
                    type={showPassword ? "text" : "password"} 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loading || !newPassword}>Update Password</Button>
            </CardFooter>
          </form>
        </Card>

        {/* Theme Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize the look and feel of your learning experience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    theme === t.id ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${t.color} border shadow-sm`}>
                    <t.icon className={`h-6 w-6 ${t.id === 'dark' || t.id === 'midnight' ? 'text-white' : 'text-slate-900'}`} />
                  </div>
                  <span className="text-sm font-medium">{t.name}</span>
                  {theme === t.id && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {theme === 'custom' && (
              <div className="p-6 bg-muted/30 rounded-2xl border-2 border-dashed space-y-6">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">Custom Theme Builder</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={customColors.primary} 
                        onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                        className="h-10 w-10 rounded cursor-pointer"
                      />
                      <Input value={customColors.primary} onChange={(e) => handleCustomColorChange('primary', e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Background</Label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={customColors.background} 
                        onChange={(e) => handleCustomColorChange('background', e.target.value)}
                        className="h-10 w-10 rounded cursor-pointer"
                      />
                      <Input value={customColors.background} onChange={(e) => handleCustomColorChange('background', e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Text Color</Label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={customColors.foreground} 
                        onChange={(e) => handleCustomColorChange('foreground', e.target.value)}
                        className="h-10 w-10 rounded cursor-pointer"
                      />
                      <Input value={customColors.foreground} onChange={(e) => handleCustomColorChange('foreground', e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={customColors.accent} 
                        onChange={(e) => handleCustomColorChange('accent', e.target.value)}
                        className="h-10 w-10 rounded cursor-pointer"
                      />
                      <Input value={customColors.accent} onChange={(e) => handleCustomColorChange('accent', e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-background rounded-lg border shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Live Preview</p>
                  <div className="flex items-center gap-4">
                    <Button style={{ backgroundColor: customColors.primary, color: customColors.background }}>Primary Button</Button>
                    <div className="p-2 rounded" style={{ backgroundColor: customColors.accent, color: customColors.foreground }}>Accent Area</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Permission Level</span>
              <span className="font-bold text-lg">Level {profile?.level || '1'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Academic Level</span>
              <span className="font-bold text-lg">{profile?.academicLevel || profile?.level || '100'} Level</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Activation Status</span>
              <span className={`font-bold text-lg ${profile?.isActivated ? 'text-green-500' : 'text-red-500'}`}>
                {profile?.isActivated ? 'Activated' : 'Not Activated'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Student ID (11-digit)</span>
              <div className="flex items-center gap-2 bg-muted px-2 py-1 rounded allow-copy">
                <span className="font-mono text-lg">{profile?.studentId || 'N/A'}</span>
                {profile?.studentId && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-primary" 
                    onClick={() => {
                      navigator.clipboard.writeText(profile.studentId);
                      toast.success('Student ID copied!');
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Firebase UID</span>
              <div className="flex items-center gap-2 bg-muted px-2 py-1 rounded opacity-50 allow-copy">
                <span className="font-mono text-xs">{user?.uid}</span>
                {user?.uid && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-primary" 
                    onClick={() => {
                      navigator.clipboard.writeText(user.uid);
                      toast.success('Firebase UID copied!');
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
