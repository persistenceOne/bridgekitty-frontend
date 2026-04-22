import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ChevronRight } from 'lucide-react';

interface AgentViewProps {
  onBack: () => void;
}

const TELEGRAM_CHAT_URL      = 'https://t.me/PersistenceOneChat';
const TWITTER_URL            = 'https://twitter.com/PersistenceOne';
const LINKEDIN_URL           = 'https://www.linkedin.com/company/persistenceone/';
const TELEGRAM_URL           = 'https://t.me/PersistenceOne';
const YOUTUBE_URL            = 'https://bit.ly/2JihxUq';
const REDDIT_URL             = 'https://www.reddit.com/r/PersistenceOne/';

function PromptBlock({ label = 'Ask your agent:', text }: { label?: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="hf-agent-prompt-block">
      <p className="hf-agent-prompt-label">{label}</p>
      <div className="hf-agent-prompt-text-wrap">
        <p className="hf-agent-prompt-text">{text}</p>
        <button className="hf-agent-copy-btn" onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export function AgentView({ onBack }: AgentViewProps) {
  return (
    <motion.main
      key="agent"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.24 }}
      className="hf-content hf-agent-page"
    >
      <div className="hf-agent-inner">

        {/* ── Intro ─────────────────────────────────────────── */}
        <div className="hf-agent-hero">
          <h2 className="hf-agent-headline">Introducing BridgeKitty MCP 🐈</h2>
          <p className="hf-agent-sub">Dear Persisters,</p>
          <p className="hf-agent-sub">We've been building something behind the scenes.</p>
          <p className="hf-agent-sub">And today, it's time to share it with you. We're excited to see what you do with it.</p>
          <p className="hf-agent-sub">Introducing BridgeKitty MCP 🐈 for your AI agent.</p>
          <p className="hf-agent-sub">
            BridgeKitty MCP is a <strong>cross-chain bridge aggregator for AI agents</strong>, connecting
            the best routes across EVM, Solana, and Cosmos.
          </p>
          <p className="hf-agent-sub">
            We strongly believe that AI agents will become the main users in DeFi. This is a step towards that.
          </p>
          <p className="hf-agent-sub">
            BridgeKitty MCP makes it easier to interact with our Interop product, move assets across chains,
            and explore DeFi using simple, natural language with your agent.
          </p>
          <p className="hf-agent-sub">
            It's still early.<br />
            But we've already added a set of functionalities that you can start using today.
          </p>
          <p className="hf-agent-sub">We'll walk you through everything BridgeKitty MCP can do in this guide.</p>
          <p className="hf-agent-sub">Feel free to explore at your own pace.</p>
          <p className="hf-agent-sub">
            And if you have any questions, reach out to the team or moderators in the{' '}
            <a href={TELEGRAM_CHAT_URL} target="_blank" rel="noopener noreferrer" className="hf-agent-inline-link">
              community chat
            </a>
            . We'll be happy to help.
          </p>
        </div>

        {/* ── Table of Contents ─────────────────────────────── */}
        <div className="hf-agent-toc">
          <p className="hf-agent-toc-title">Table of Contents</p>
          <ol className="hf-agent-toc-list">
            {([
              ['#step-1', 'Step 1: Install BridgeKitty MCP'],
              ['#step-2', 'Step 2: What can your agent do with BridgeKitty MCP'],
              ['#step-3', 'Step 3: Set up your agent wallet'],
              ['#step-4', 'Step 4: Move assets across networks'],
              ['#step-5', 'Step 5: Explore with your agent'],
              ['#enables', 'What BridgeKitty MCP enables'],
              ['#wrapping', 'Before wrapping up'],
              ['#about',   'About Persistence One'],
            ] as [string, string][]).map(([href, label]) => (
              <li key={href}>
                <a href={href} className="hf-agent-toc-link">
                  <ChevronRight size={12} />
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* ── Step 1 ────────────────────────────────────────── */}
        <div className="hf-agent-section" id="step-1">
          <div className="hf-agent-section-header">
            <h3>Step 1: Install BridgeKitty MCP</h3>
          </div>
          <p className="hf-agent-section-desc">Let's get your agent connected.</p>
          <PromptBlock text="Install the @persistenceone/bridgekitty package using npm i, then verify the connection." />
          <p className="hf-agent-section-desc">
            Once this is done, your agent is ready to start interacting with BridgeKitty MCP.
          </p>
        </div>

        {/* ── Step 2 ────────────────────────────────────────── */}
        <div className="hf-agent-section" id="step-2">
          <div className="hf-agent-section-header">
            <h3>Step 2: What can your agent do with BridgeKitty MCP</h3>
          </div>
          <p className="hf-agent-section-desc">
            Now that BridgeKitty MCP is installed, let's understand what it can do.
          </p>
          <PromptBlock text="Tell me what I can do with BridgeKitty MCP in five points." />
          <p className="hf-agent-section-desc">
            Your agent will return a list of capabilities and actions it can perform across chains.
          </p>
          <p className="hf-agent-section-desc">
            This is the easiest way to get familiar before trying anything advanced.
          </p>
          <p className="hf-agent-section-desc">If something stands out, try it.</p>
        </div>

        {/* ── Step 3 ────────────────────────────────────────── */}
        <div className="hf-agent-section" id="step-3">
          <div className="hf-agent-section-header">
            <h3>Step 3: Set up your agent wallet</h3>
          </div>
          <p className="hf-agent-section-desc">
            Before doing anything on-chain, your agent needs a wallet.
          </p>
          <p className="hf-agent-section-desc">You don't have to create this manually.</p>
          <PromptBlock text="Create a fresh wallet for me and tell me where you'll store my keys securely" />
          <PromptBlock label="Then:" text="Tell me my wallet balances across chains" />
          <div className="hf-agent-bullets">
            <p className="hf-agent-bullets-title">Your agent will:</p>
            <ul>
              <li>Create wallets across supported chains</li>
              <li>Secure your keys locally</li>
              <li>Fetch your balances across networks</li>
            </ul>
          </div>
          <p className="hf-agent-section-desc">You're now ready to start interacting.</p>
        </div>

        {/* ── Step 4 ────────────────────────────────────────── */}
        <div className="hf-agent-section" id="step-4">
          <div className="hf-agent-section-header">
            <h3>Step 4: Move assets across networks</h3>
          </div>
          <p className="hf-agent-section-desc">Now comes the core use case.</p>
          <PromptBlock text="Bridge 0.001 cbBTC on Base to BTCB on BSC" />
          <div className="hf-agent-bullets">
            <p className="hf-agent-bullets-title">Your agent will:</p>
            <ul>
              <li>Find the best route</li>
              <li>Execute the transaction</li>
              <li>Return the status</li>
            </ul>
          </div>
          <p className="hf-agent-section-desc">No dashboards. No switching tabs. No manual routing.</p>
        </div>

        {/* ── Step 5 ────────────────────────────────────────── */}
        <div className="hf-agent-section" id="step-5">
          <div className="hf-agent-section-header">
            <h3>Step 5: Explore with your agent</h3>
          </div>
          <p className="hf-agent-section-desc">Once you're comfortable, you can go deeper.</p>
          <PromptBlock
            text={`How can I farm XPRT?\nWhat's my multiplier?\nConvert 0.01 ETH into staked XPRT so I can get a farming multiplier\nStart farming XPRT`}
          />
          <p className="hf-agent-section-desc">
            BridgeKitty MCP allows your agent to interact directly with these workflows.
          </p>
          <p className="hf-agent-section-desc">This is where things start to feel different.</p>
        </div>

        {/* ── What it enables ───────────────────────────────── */}
        <div className="hf-agent-section" id="enables">
          <div className="hf-agent-section-header">
            <h3>What BridgeKitty MCP enables</h3>
          </div>
          <p className="hf-agent-section-desc">With BridgeKitty MCP, your agent can:</p>
          <div className="hf-agent-enables-grid">
            {[
              'create wallets',
              'check balances across chains',
              'move BTC assets between networks',
              'bridge assets',
              'start farming $XPRT',
            ].map((item) => (
              <div key={item} className="hf-agent-enables-item">
                <span className="hf-agent-enables-dot" />
                {item}
              </div>
            ))}
          </div>
          <p className="hf-agent-section-desc" style={{ marginTop: '1rem' }}>
            All through simple prompts.
          </p>
        </div>

        {/* ── Before wrapping up ────────────────────────────── */}
        <div className="hf-agent-section hf-agent-closing" id="wrapping">
          <p className="hf-agent-closing-text">BridgeKitty MCP is early. But the direction is clear.</p>
          <p className="hf-agent-closing-text">
            AI agents won't just assist in DeFi.<br />They'll operate within it.
          </p>
          <p className="hf-agent-closing-text">
            The experience needs to match that shift. BridgeKitty MCP is one step in that direction.
          </p>
          <p className="hf-agent-closing-cta">Try it. Break it. Push it further.</p>
          <p className="hf-agent-closing-text">We're excited to see what you prompt.</p>
        </div>

        {/* ── About Persistence One ─────────────────────────── */}
        <div className="hf-agent-section" id="about">
          <div className="hf-agent-section-header">
            <h3>About Persistence One</h3>
          </div>
          <p className="hf-agent-section-desc">
            Persistence One is building intent-based Bitcoin interoperability—simple, reliable
            cross-chain swaps across Bitcoin L2s, sidechains, and BTC-aligned networks.
          </p>
          <p className="hf-agent-section-desc">
            Our mission is to reduce fragmentation across the Bitcoin ecosystem and make
            cross-chain value transfer intuitive for users, developers, and partners.
          </p>
          <p className="hf-agent-section-desc hf-agent-about-links">
            <a href={TWITTER_URL}  target="_blank" rel="noopener noreferrer" className="hf-agent-inline-link">Twitter</a>
            {' | '}
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="hf-agent-inline-link">LinkedIn</a>
            {' | '}
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="hf-agent-inline-link">Telegram</a>
            {' | '}
            <a href={YOUTUBE_URL}  target="_blank" rel="noopener noreferrer" className="hf-agent-inline-link">YouTube</a>
            {' | '}
            <a href={REDDIT_URL}   target="_blank" rel="noopener noreferrer" className="hf-agent-inline-link">Reddit</a>
            {' | '}
            <a href="mailto:hello@persistence.one" className="hf-agent-inline-link">hello@persistence.one</a>
          </p>
        </div>

        {/* ── Back ──────────────────────────────────────────── */}
        <div className="hf-agent-footer">
          <button className="hf-btn hf-btn-secondary" onClick={onBack}>
            Back to Homepage
          </button>
        </div>

      </div>
    </motion.main>
  );
}
