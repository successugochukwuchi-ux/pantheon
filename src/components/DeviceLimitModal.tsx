import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, MessageCircle, Phone, Mail, Copy, Check, School, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { AdminContactInfo } from '../services/adminContactService';

export interface DeviceLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminInfo: AdminContactInfo | null;
  accountEmail?: string;
  studentId?: string;
  semester?: string;
}

export const DeviceLimitModal: React.FC<DeviceLimitModalProps> = ({
  isOpen,
  onClose,
  adminInfo,
  accountEmail,
  studentId,
  semester = '1st',
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!adminInfo) return null;

  const prefilledMessage = encodeURIComponent(
    `Hello ${adminInfo.name}, I reached the 2-device limit on my CoLearn account (${accountEmail || 'Account'}${studentId ? `, Student ID: ${studentId}` : ''}) for the ${semester} semester. Could you please assist me in resetting or unlinking an old device?`
  );

  const whatsappUrl = `https://wa.me/${adminInfo.whatsapp}?text=${prefilledMessage}`;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(adminInfo.phone);
    setCopied(true);
    toast.success("Admin phone number copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl rounded-3xl p-6 sm:p-7">
        <DialogHeader className="space-y-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-inner">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-1">
                <ShieldAlert className="h-3 w-3" />
                Device Slot Limit
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Device Limit Reached
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-1">
            This account has reached the maximum of <span className="font-semibold text-foreground">2 active devices</span> for the current semester ({semester}). To unlink an old device or approve this device, contact your campus administrator:
          </DialogDescription>
        </DialogHeader>

        {/* Administrator Contact Card */}
        <div className="my-2 p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-3.5">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <School className="h-3.5 w-3.5 text-primary" />
                {adminInfo.university} Administrator
              </span>
              <h4 className="text-base font-bold text-foreground">
                {adminInfo.name}
              </h4>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Available
            </span>
          </div>

          <div className="pt-1 flex flex-col gap-2">
            {/* WhatsApp Link Button */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full h-11 px-4 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4 fill-white" />
              Chat on WhatsApp
            </a>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`tel:${adminInfo.phone.replace(/\s+/g, '')}`}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl font-medium text-xs bg-background hover:bg-muted border border-border text-foreground transition-colors"
              >
                <Phone className="h-3.5 w-3.5 text-primary" />
                Call Admin
              </a>

              <button
                type="button"
                onClick={handleCopyPhone}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl font-medium text-xs bg-background hover:bg-muted border border-border text-foreground transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Phone"}
              </button>
            </div>

            {adminInfo.email && (
              <a
                href={`mailto:${adminInfo.email}?subject=${encodeURIComponent(`CoLearn Device Limit Assistance - ${adminInfo.university}`)}&body=${prefilledMessage}`}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground pt-1 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                {adminInfo.email}
              </a>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto rounded-xl"
            onClick={onClose}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
