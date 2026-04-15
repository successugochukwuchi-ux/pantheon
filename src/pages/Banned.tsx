import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { MessageCircle, ShieldAlert } from 'lucide-react';

export default function Banned() {
  const { profile } = useAuth();

  const openAppeal = () => {
    const message = encodeURIComponent(`Hello, my account (UID: ${profile?.uid}) has been banned. I want to appeal. Reason given: ${profile?.banReason}`);
    window.open(`https://wa.me/2348118429150?text=${message}`, '_blank');
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-16rem)]">
      <Card className="w-full max-w-md border-destructive">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ShieldAlert className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">Account Banned</CardTitle>
          <CardDescription>
            Your account has been restricted from accessing Pantheon features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
            <p className="text-sm font-semibold text-destructive uppercase mb-1">Reason for Ban</p>
            <p className="text-sm italic">"{profile?.banReason || 'No reason provided'}"</p>
          </div>
          <p className="text-sm text-muted-foreground">
            If you believe this is a mistake, you can appeal the ban by contacting an admin.
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full bg-green-500 hover:bg-green-600 text-white"
            onClick={openAppeal}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Appeal via WhatsApp
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
