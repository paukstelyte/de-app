import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = { title: "Privacy" };

const CONTACT = "egle.pauk.ai@gmail.com";

export default function PrivacyPage() {
  return (
    <article className="flex max-w-2xl flex-col gap-8">
      <div>
        <div className="mb-5 h-2 w-12 bg-[var(--accent)]" />
        <h1 className="text-4xl font-bold leading-none tracking-[-0.06em] sm:text-5xl">Privacy</h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          DE-app is a small, non-commercial learning project. It stores only what it needs to save
          your practice, and nothing is sold, shared for advertising or used for tracking.
          Last updated: 9 October 2026.
        </p>
      </div>

      <Section title="Playing without an account">
        <p>
          Nothing about you is sent to our servers. Your browser keeps three small notes in its own
          storage: which words you keep missing, the level you picked, and light or dark mode. You
          can clear them any time by clearing this site&apos;s data in your browser.
        </p>
      </Section>

      <Section title="What we store when you have an account">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Your email address</strong>, and your password in scrambled (hashed) form, never
            as plain text.
          </li>
          <li>
            <strong>If you choose &ldquo;Continue with Google&rdquo;:</strong> the name, email address and profile picture
            link that Google shares with us. We never see your Google password.
          </li>
          <li>
            <strong>Your practice answers:</strong> for each answer, which word it was, what you
            picked, whether it was right, and when. This is what builds your progress page and your
            &ldquo;Practise my mistakes&rdquo; list.
          </li>
          <li>
            <strong>Your Customized Learning documents:</strong> the title, the text read from each
            document and the suggested topics, plus your focus list. The original files are deleted
            straight after reading; if an upload is interrupted, the file is removed the next time
            you upload or when you delete your account.
          </li>
          <li>
            <strong>A count of your uploads</strong>, used for the daily limit.
          </li>
          <li>
            <strong>Login cookies</strong> that keep you signed in. There are no analytics,
            advertising or tracking cookies.
          </li>
        </ul>
        <p>Nobody else can see your answers or your documents. The database only lets each account read its own.</p>
      </Section>

      <Section title="Services that handle your data for us">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Supabase</strong>: accounts, login, the answer database, your Customized Learning
            documents and, briefly, uploaded files, on servers in Ireland (EU).
          </li>
          <li>
            <strong>Vercel</strong>: hosts the website (servers in Dublin, Ireland) and keeps short-lived
            technical request logs.
          </li>
          <li>
            <strong>Brevo</strong>: sends the sign-up confirmation and password-reset emails, so it
            sees your email address.
          </li>
          <li>
            <strong>Google</strong>: only if you choose &ldquo;Continue with Google&rdquo;, to sign you in.
          </li>
          <li>
            <strong>OpenRouter and Google Gemini</strong>: documents you upload to Customized Learning
            are sent through OpenRouter to Google&rsquo;s Gemini model, which reads them and suggests
            topics. Don&rsquo;t upload documents with personal details.
          </li>
        </ul>
      </Section>

      <Section title="Keeping and deleting your data">
        <p>
          Your data is kept for as long as you have an account. You can delete your account at any
          time on the <Link href="/account" className="underline underline-offset-2">Account</Link>{" "}
          page: this immediately and permanently removes your account, every answer you saved, your Customized Learning documents and focus list.
        </p>
      </Section>

      <Section title="Your rights and contact">
        <p>
          Under EU data protection law (GDPR) you can ask to see, correct or delete the data we hold
          about you. Write to{" "}
          <a href={`mailto:${CONTACT}`} className="underline underline-offset-2">
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-[var(--line)] pt-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">{title}</h2>
      {children}
    </section>
  );
}
