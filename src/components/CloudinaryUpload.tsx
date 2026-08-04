import React, { useState } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

interface CloudinaryUploadProps {
  onUploadSuccess: (url: string, resourceType: string) => void;
  acceptedTypes?: string;
  label?: string;
  className?: string;
  folder?: string;
  uploadPreset?: string;
  uploadResourceType?: 'auto' | 'image' | 'video' | 'raw';
}

export const CloudinaryUpload: React.FC<CloudinaryUploadProps> = ({
  onUploadSuccess,
  acceptedTypes = 'image/*,video/*',
  label = 'Upload Image or Video',
  className = '',
  folder = 'colodge_listings',
  uploadPreset = 'colodge_unsigned',
  uploadResourceType = 'auto',
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);
    setSuccess(false);

    try {
      const isApk = file.name.toLowerCase().endsWith('.apk');
      const effectiveResourceType = isApk ? 'raw' : uploadResourceType;

      // Cloudinary unsigned free preset enforces a strict 10MB limit on raw files (e.g. APKs)
      if (effectiveResourceType === 'raw' && file.size > 10 * 1024 * 1024) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        throw new Error(
          `File size (${sizeMB} MB) exceeds Cloudinary's 10 MB raw limit for unsigned uploads. Please use the Direct Server Uploader or host on GitHub Releases.`
        );
      }
      
      const formData = new FormData();
      if (isApk) {
        // Disguise .apk as .apk.bin to bypass Cloudinary extension restriction for raw files
        const sanitizedFileName = file.name.replace(/\.apk$/i, '.apk.bin');
        const renamedFile = new File([file], sanitizedFileName, { type: 'application/octet-stream' });
        formData.append('file', renamedFile);
      } else {
        formData.append('file', file);
      }
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', folder);

      const xhr = new XMLHttpRequest();
      const endpoint = `https://api.cloudinary.com/v1_1/lfrjrbtz/${effectiveResourceType}/upload`;
      xhr.open('POST', endpoint, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          const secureUrl = response.secure_url;
          const resourceType = response.resource_type || (file.type.startsWith('video/') ? 'video' : 'image');
          setSuccess(true);
          setUploading(false);
          onUploadSuccess(secureUrl, resourceType);
        } else {
          let errorMsg = 'Upload failed';
          try {
            const resp = JSON.parse(xhr.responseText);
            if (resp.error?.message) {
              errorMsg = resp.error.message;
            }
          } catch (err) {}
          setError(errorMsg);
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        setError('Network error occurred during upload.');
        setUploading(false);
      };

      xhr.send(formData);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setUploading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
        {label}
      </label>
      
      <div className="flex flex-col gap-2">
        <div className="relative">
          <input
            type="file"
            accept={acceptedTypes}
            onChange={handleFileChange}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            id={`cloudinary-upload-${label.replace(/\s+/g, '-').toLowerCase()}`}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-dashed bg-stone-50 hover:bg-stone-100 dark:bg-stone-900/20 dark:hover:bg-stone-900/40 relative"
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span className="text-stone-600 dark:text-stone-300">Uploading ({progress}%)</span>
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">Upload Complete!</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 text-stone-400" />
                <span>Choose File to Upload</span>
              </>
            )}
          </Button>
        </div>

        {uploading && (
          <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded-lg border border-red-100 dark:border-red-950/50">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
