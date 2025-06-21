export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-3xl p-4 md:p-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Privacy Policy
        </h1>
      </header>
      
      <article className="prose dark:prose-invert max-w-none">
        <h2>1. Introduction</h2>
        <p>
          Welcome to WaitWise ("we", "us", "our"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services (the "Service").
        </p>
        <p>
          By using the Service, you agree to the collection and use of information in accordance with this policy.
        </p>

        <h2>2. Information We Collect</h2>
        <p>
          We collect information that you provide directly to us and information that pertains to your customers when you use our Service.
        </p>
        <h3>Information You (The Business Owner) Provide to Us:</h3>
        <ul>
            <li><strong>Account Information:</strong> When you register for an account, we collect your email address, a username, and a hashed password.</li>
            <li><strong>Shop Information:</strong> To set up your dashboard, we collect your shop's name, address, and your specified opening and closing times.</li>
            <li><strong>Billing Information:</strong> To process payments, we utilize Stripe. We may store a Stripe Customer ID associated with your account, but we do not store your full credit card details on our servers.</li>
        </ul>

        <h3>Information You Provide About Your Customers (End-Users):</h3>
        <ul>
            <li><strong>Queue Information:</strong> When an end-user joins your queue through our Service, you provide us with their name and phone number. It is your responsibility to have the necessary consent from your customers to provide this information to us.</li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <p>
          We use the information we collect for various purposes, including to:
        </p>
        <ul>
            <li>Provide, operate, and maintain our Service.</li>
            <li>Process your registration and create your user account.</li>
            <li>Manage your shop's queue, including services  and barbers.</li>
            <li>Process payments and manage your account balance for our pay-as-you-go service.</li>
            <li>Communicate with you, including sending confirmation emails or responding to your support requests.</li>
            <li>Monitor and analyze usage and trends to improve your experience with the Service.</li>
        </ul>

        <h2>4. How We Share Your Information</h2>
        <p>
          We do not sell your personal information. We may share information with third-party vendors and service providers that perform services for us, under the following circumstances:
        </p>
        <ul>
            <li><strong>With Supabase:</strong> Our backend, database, and authentication services are provided by Supabase. All of the data we collect is stored on their platform.</li>
            <li><strong>With Stripe:</strong> For payment processing and managing billing portals.</li>
            <li><strong>For Legal Compliance:</strong> We may disclose your information if required to do so by law or in response to valid requests by public authorities.</li>
        </ul>

        <h2>5. Data Storage and Security</h2>
        <p>
          We use Supabase to store your data and rely on their security measures to protect it. We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access. Passwords you provide when registering are hashed and are not visible to us.
        </p>

        <h2>6. Your Data Rights</h2>
        <p>
          In accordance with the Australian Privacy Principles (APPs), you have the right to access, update, or request deletion of your personal information. You can manage some of your shop information directly from your dashboard. For any other requests, please contact us using the details below.
        </p>

        <h2>7. Children's Privacy</h2>
        <p>
          Our Service is not intended for use by anyone under the age of 18. We do not knowingly collect personally identifiable information from children.
        </p>

        <h2>8. Changes to This Privacy Policy</h2>
        <p>
          We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
        </p>

        <h2>9. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at: [Your Contact Email]
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