export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto max-w-3xl p-4 md:p-8">
      {/* --- UPDATED HEADER: Centered and with more vertical spacing --- */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Terms of Service
        </h1>
      </header>
      <article className="prose dark:prose-invert max-w-none">
        {/* Introduction */}
        <h2>1. Agreement to Terms</h2>
        <p>
          By creating an account and using the WaitWise platform (the
          &quot;Service&quot;), you agree to be bound by these Terms of Service
          (&quot;Terms&quot;). If you disagree with any part of the terms, you
          may not access the Service.
        </p>

        <h2>2. The Service</h2>
        <p>
          WaitWise provides a digital queue management platform that allows
          businesses (our &quot;Clients&quot;) to manage their customer
          waitlists online. The Service allows Clients to create a public-facing
          page where their customers (&quot;End-Users&quot;) can join a queue
          for services.
        </p>

        <h2>3. User Accounts</h2>
        <p>
          To use the Service, you must register for an account. You agree to
          provide accurate, complete, and current information during the
          registration process. You are responsible for safeguarding your
          password and for any activities or actions under your account. You
          must be at least 18 years old to create an account.
        </p>

        <h2>4. Pricing and Payment</h2>
        <p>Our Service is offered on a usage-based, pay-as-you-go model.</p>
        <ul>
          <li>
            <strong>Free Trial:</strong> New Clients will receive a free trial
            which includes the first 100 completed client jobs at no charge.
          </li>
          <li>
            <strong>Usage Fee:</strong> After the trial period, a fee of $0.25
            AUD will be charged for each End-User who is moved to a
            &quot;Done&quot; status in your dashboard. This constitutes a
            &quot;Completed Client&quot;.
          </li>
          <li>
            <strong>Account Balance:</strong> You must maintain a positive
            account balance to use the Service. You can add funds to your
            account through our billing portal. Payments are processed via our
            third-party payment processor, Stripe. By providing payment
            information, you agree to their terms.
          </li>
          <li>
            <strong>Non-Refundable:</strong> All fees and charges are
            non-refundable.
          </li>
        </ul>

        <h2>5. Client and End-User Data</h2>
        <p>
          You are solely responsible for the accuracy and legality of all data
          you provide to the Service.
        </p>
        <ul>
          <li>
            <strong>Your Data:</strong> You are responsible for keeping your
            shop information, including name, address, and operating hours, up
            to date.
          </li>
          <li>
            <strong>End-User Data:</strong> You represent and warrant that you
            have obtained all necessary consents from your End-Users to collect
            and provide their personal information (such as name and phone
            number) to the Service for the purpose of managing the queue.
          </li>
        </ul>

        <h2>6. Acceptable Use</h2>
        <p>
          You agree not to use the Service for any unlawful purpose or to
          violate any laws in your jurisdiction. You will not misuse or abuse
          the Service, including but not limited to:
        </p>
        <ul>
          <li>
            Attempting to reverse engineer or compromise the Service&apos;s
            integrity.
          </li>
          <li>Using the Service to send unsolicited communications.</li>
          <li>Uploading any malicious code or viruses.</li>
        </ul>

        <h2>7. Termination</h2>
        <p>
          You may terminate your account at any time by ceasing to use the
          Service. We reserve the right to suspend or terminate your account
          immediately, without prior notice or liability, if you breach these
          Terms. Upon termination, your right to use the Service will
          immediately cease.
        </p>

        <h2>8. Disclaimer of Warranties and Limitation of Liability</h2>
        <p>
          The Service is provided on an &quot;AS IS&quot; and &quot;AS
          AVAILABLE&quot; basis. We make no warranties, expressed or implied,
          regarding the operation or availability of the Service.
        </p>
        <p>
          In no event shall WaitWise, nor its directors or employees, be liable
          for any indirect, incidental, special, consequential or punitive
          damages, including without limitation, loss of profits, data, or other
          intangible losses, resulting from your access to or use of or
          inability to access or use the Service.
        </p>

        <h2>9. Governing Law</h2>
        <p>
          These Terms shall be governed and construed in accordance with the
          laws of New South Wales, Australia, without regard to its conflict of
          law provisions.
        </p>

        <h2>10. Changes to Terms</h2>
        <p>
          We reserve the right, at our sole discretion, to modify or replace
          these Terms at any time. If a revision is material, we will provide at
          least 30 days&apos; notice prior to any new terms taking effect. What
          constitutes a material change will be determined at our sole
          discretion.
        </p>

        <h2>11. Contact Us</h2>
        <p>
          If you have any questions about these Terms, please contact us at:
          [Your Contact Email]
        </p>
      </article>
      <div className="mt-12 border-t pt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Last Updated: June 21, 2025
        </p>
      </div>
    </div>
  );
}
