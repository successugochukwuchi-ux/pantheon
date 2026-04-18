import React, { useState } from 'react';
import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
import { Check, Moon, Sun, Palette, Droplets, TreePine, Eye, EyeOff, Settings as SettingsIcon, User } from 'lucide-react';
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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (user) {
        const photoURL = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${avatarSeed}`;
        await updateProfile(user, { photoURL });
        await updateDoc(doc(db, 'users', user.uid), {
          username: username
        });
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
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="h-24 w-24 border-4 border-muted">
                    <AvatarImage src={`https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${avatarSeed}`} />
                    <AvatarFallback>{username[0]?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2 w-full">
                    <Label className="text-center">Avatar Seed</Label>
                    <Input 
                      value={avatarSeed} 
                      onChange={(e) => setAvatarSeed(e.target.value)}
                      placeholder="Enter any text..."
                      className="text-center"
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-4 w-full">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={user?.email || ''} disabled className="bg-muted" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Avatar Style</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {avatars.map(style => (
                        <Button 
                          key={style}
                          type="button"
                          variant={avatarStyle === style ? 'default' : 'outline'}
                          size="sm"
                          className="text-[10px] h-8 px-1"
                          onClick={() => setAvatarStyle(style)}
                        >
                          {style.replace('-', ' ')}
                        </Button>
                      ))}
                    </div>
                  </div>
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
              <span className="text-xs text-muted-foreground uppercase font-semibold">Student UID (11-digit)</span>
              <span className="font-mono text-lg bg-muted px-2 py-1 rounded">{profile?.studentId || 'N/A'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Firebase UID</span>
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded opacity-50">{user?.uid}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
