import { useState } from 'react';
import { motion } from 'motion/react';

const RAW = `Customer Jane Doe called +1-415-555-0132 about invoice.
SSN on file: 078-05-1120. Card ending 4111 1111 1111 1111.
Email jane.doe@acme-corp.example — please refund.`;

const CLEARED = `Customer [CUSTOMER_NAME_1] called [PHONE_1] about invoice.
SSN on file: [SSN_1]. Card ending [CREDIT_CARD_1].
Email [EMAIL_1] — please refund.`;

/**
 * Interactive raw ticket → cleared prompt toggle (phone/SSN/card masked).
 */
export function DataCleanupDemo() {
  const [cleared, setCleared] = useState(true);

  return (
    <section className="py-16 sm:py-20" aria-labelledby="cleanup-demo-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold tracking-tight text-primary">PII / PCI clearing</p>
        <h2
          id="cleanup-demo-heading"
          className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Clean before the model sees it
        </h2>
        <p className="mt-3 text-base leading-7 text-on-surface-variant">
          Toggle raw ticket text versus the cleared prompt. Modes match PII rules: redact, block,
          hash, or allow.
        </p>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setCleared(false)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              !cleared
                ? 'bg-on-surface text-surface'
                : 'border border-outline-variant bg-surface text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Raw ticket
          </button>
          <button
            type="button"
            onClick={() => setCleared(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              cleared
                ? 'bg-mint-container text-on-mint-container'
                : 'border border-outline-variant bg-surface text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Cleared prompt
          </button>
        </div>

        <motion.pre
          key={cleared ? 'cleared' : 'raw'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`mt-5 overflow-x-auto border px-4 py-4 font-mono text-xs leading-6 sm:text-sm ${
            cleared
              ? 'border-mint/35 bg-mint-container/35 text-on-surface'
              : 'border-outline-variant/70 bg-surface-container-lowest text-on-surface'
          }`}
        >
          {cleared ? CLEARED : RAW}
        </motion.pre>

        <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
          <li>
            <span className="font-semibold text-on-surface">redact</span> — placeholder tokens
          </li>
          <li>
            <span className="font-semibold text-on-surface">block</span> — stop the AI job
          </li>
          <li>
            <span className="font-semibold text-on-surface">hash</span> — correlation value only
          </li>
        </ul>
      </div>
    </section>
  );
}
