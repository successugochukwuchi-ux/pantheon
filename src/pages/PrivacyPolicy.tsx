import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';

export default function PrivacyPolicy() {
  useTitle('Privacy Policy');

  return (
    <div className="container max-w-4xl py-12 px-4 mx-auto">
      <Link to="/">
        <Button 
          variant="ghost" 
          className="mb-6 hover:bg-primary/10 hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </Link>

      <Card className="border-none shadow-xl bg-card/50 backdrop-blur">
        <CardHeader className="text-center pb-8 border-b">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 transition-transform hover:scale-110 duration-300">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-4xl font-bold tracking-tight">Privacy Policy</CardTitle>
          <p className="text-muted-foreground mt-2">Last updated: April 17, 2026</p>
        </CardHeader>
        <CardContent className="prose prose-slate dark:prose-invert max-w-none p-8 md:p-12 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">1. Introduction</h2>
            <p>
              Welcome to PANTHEON ("we," "our," or "us"). We are committed to protecting your privacy and ensuring that your personal information is handled in a safe and responsible manner. This Privacy Policy outlines how we collect, use, disclose, and safeguard your information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Personal Information</h3>
                <p>When you register for an account, we collect information such as your name, email address, student ID, and level of study.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Usage Data</h3>
                <p>We collect information about your interactions with our platform, including courses viewed, CBT scores, and chat messages.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Authentication Data</h3>
                <p>We use Firebase Authentication to manage your login credentials securely.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide and maintain our Service.</li>
              <li>To notify you about changes to our Service.</li>
              <li>To allow you to participate in interactive features (Chat, Discussions).</li>
              <li>To provide student support and track academic progress.</li>
              <li>To gather analysis or valuable information so that we can improve the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">4. Data Security</h2>
            <p>
              The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">5. Third-Party Services</h2>
            <p>
              We use Firebase (a Google service) for database management and authentication. Your data is stored on secure European servers (europe-west3) managed by Google Cloud.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at successcugo@gmail.com.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
