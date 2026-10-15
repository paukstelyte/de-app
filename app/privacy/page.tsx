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
          Last updated: 15 October 2026.
        </p>
      </div>

      <Section title="Playing without an account">
        <p>
          Your practice isn&apos;t sent to our servers. Your browser keeps a few small notes in its
          own storage: which words you keep missing, the level you picked, light or dark mode, and
          how a correct answer moves on. You can clear them any time by clearing this site&apos;s
          data in your browser. Like any website, our host logs each page request, including your
          IP address (see below).
        </p>
      </Section>

      <Section title="What we store when you have an account">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Your email address</strong>, and your password in scrambled (hashed) form, never
            as plain text. Our login provider also records sign-in details such as the time of your
            last sign-in and your IP address.
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
            document, the suggested topics, and which AI model read it and what that cost, plus your
            focus list. The original files are deleted
            straight after reading; if an upload is interrupted, the file is removed the next time
            you upload or when you delete your account.
          </li>
          <li>
            <strong>A count of your uploads</strong> (who and when), used for the daily limit.
          </li>
          <li>
            <strong>Login cookies</strong> that keep you signed in. There are no analytics,
            advertising or tracking cookies.
          </li>
        </ul>
        <p>Nobody else can see your answers or your documents. The database only lets each account read its own.</p>
      </Section>

      <Section title="Why we use it">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>To provide the app you signed up for</strong>: your account, sign-in emails,
            saved answers, documents and focus list (GDPR Art. 6(1)(b), contract).
          </li>
          <li>
            <strong>To read a document you upload</strong>: it is sent to the AI only when you press
            &ldquo;Read&rdquo;. That is your choice, and you can withdraw it at any time by deleting
            the document (Art. 6(1)(a), consent).
          </li>
          <li>
            <strong>To keep the app safe and its costs under control</strong>: the upload count and
            short-lived request and sign-in logs (Art. 6(1)(f), our legitimate interest in preventing
            abuse).
          </li>
        </ul>
      </Section>

      <Section title="Services that handle your data for us">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Supabase</strong>: accounts, login, the answer database, your Customized Learning
            documents and, briefly, uploaded files, on servers in Ireland (EU).
          </li>
          <li>
            <strong>Vercel</strong>: hosts the website (servers in Dublin, Ireland) and keeps technical
            request logs, including IP addresses, for 1 hour.
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
            are sent through OpenRouter to Google&rsquo;s Gemini AI model, which reads them and
            suggests topics. We ask OpenRouter to use only providers that keep no copy of your
            document (&ldquo;zero data retention&rdquo;), so it isn&rsquo;t stored or used to train AI.
            Don&rsquo;t upload documents with personal details.
          </li>
        </ul>
        <p>
          OpenRouter is a US company, so uploaded documents leave the EU. OpenRouter protects this
          transfer with the European Commission&rsquo;s standard contractual clauses (GDPR Art. 46).
        </p>
      </Section>

      <Section title="Keeping and deleting your data">
        <p>
          Uploaded files are deleted straight after reading. Upload counts are removed once they are
          more than 2 days old. Everything else is kept for as long as you have an account. You can
          delete your account at any time on the{" "}
          <Link href="/account" className="underline underline-offset-2">Account</Link> page: this
          immediately and permanently removes your account, every answer you saved, your Customized
          Learning documents and focus list. Copies in our providers&rsquo; technical logs (request,
          sign-in and email logs) expire on their own short schedules.
        </p>
      </Section>

      <Section title="Your rights and contact">
        <p>
          Under EU data protection law (GDPR) you can ask to see, correct or delete the data we hold
          about you, get a copy to take elsewhere, ask us to limit or stop using it, and withdraw
          your consent at any time. You can download your data and delete your account yourself on
          the <Link href="/account" className="underline underline-offset-2">Account</Link> page.
          For anything else, write to{" "}
          <a href={`mailto:${CONTACT}`} className="underline underline-offset-2">
            {CONTACT}
          </a>
          ; we reply within one month. You can also complain to your national data protection
          authority.
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
