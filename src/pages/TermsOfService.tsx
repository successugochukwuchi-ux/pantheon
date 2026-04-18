import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { FileText, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';

export default function TermsOfService() {
  useTitle('Terms of Service');

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
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-4xl font-bold tracking-tight">Terms of Service</CardTitle>
          <p className="text-muted-foreground mt-2">Last updated: April 17, 2026</p>
        </CardHeader>
        <CardContent className="prose prose-slate dark:prose-invert max-w-none p-8 md:p-12 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using PANTHEON, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">2. Account Registration</h2>
            <p>
              You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">3. User Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service for any illegal purpose or in violation of any local, state, national, or international law.</li>
              <li>Post or transmit any content that is infringing, libelous, defamatory, obscene, or otherwise objectionable.</li>
              <li>Spam, harass, or threaten other users.</li>
              <li>Attempt to gain unauthorized access to any portion of the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">4. Academic Integrity</h2>
            <p>
              PANTHEON is a study aid. We do not encourage or facilitate academic dishonesty. Users should use the platform responsibly and in accordance with their institution's academic integrity policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">5. Account Activation</h2>
            <p>
              Some features of PANTHEON require account activation via a valid activation code. These codes are provided by administrators and should not be shared or resold without authorization.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">6. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users of the Service or us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">7. Changes to Terms</h2>
            <p>
              We may revise these Terms of Service from time to time. The most current version will always be posted on this page. By continuing to use the Service after changes become effective, you agree to be bound by the revised terms.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
