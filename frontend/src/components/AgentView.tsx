import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Terminal, Globe, Zap, Shield, ExternalLink, ChevronRight } from 'lucide-react';

interface AgentViewProps {
  onBack: () => void;
}

const MCP_URL = 'https://mcp.bridgekitty.xyz/mcp';
const BLOG_URL = 'https://blog.persistence.one/2026/03/18/introducing-bridgekitty-mcp/';
const TELEGRAM_URL = 'https://t.me/PersistenceOneChat';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="hf-agent-copy-btn" onClick={copy} title="Copy to clipboard">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeBlock({ code, lang = '' }: { code: string; lang?: string }) {
  return (
    <div className="hf-agent-code-wrap">
      {lang && <span className="hf-agent-code-lang">{lang}</span>}
      <CopyButton text={code} />
      <pre className="hf-agent-code"><code>{code}</code></pre>
    </div>
  );
}

function PromptBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="hf-agent-prompt-block">
      <p className="hf-agent-prompt-label">Ask your agent:</p>
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

function Step({ n, id, title, children }: { n: number; id?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="hf-agent-step" id={id}>
      <div className="hf-agent-step-num">{n}</div>
      <div className="hf-agent-step-body">
        <p className="hf-agent-step-title">{title}</p>
        {children}
      </div>
    </div>
  );
}

type SetupTab = 'claude-desktop' | 'claude-code' | 'http';

export function AgentView({ onBack }: AgentViewProps) {
  const [tab, setTab] = useState<SetupTab>('claude-desktop');

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

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="hf-agent-hero">
          <p className="hf-kicker">For Developers / AI Agents</p>
          <h2 className="hf-agent-headline">Introducing BridgeKitty MCP 🐈</h2>
          <p className="hf-agent-sub">
            If you have any questions, reach out to the team in the{' '}
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="hf-agent-inline-link">
              community chat
            </a>
            . We'll be happy to help.
          </p>
          <a
            href={BLOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hf-agent-blog-link"
          >
            <ExternalLink size={14} />
            Read the full announcement on the Persistence blog
          </a>
        </div>

        {/* ── Table of Contents ────────────────────────────── */}
        <div className="hf-agent-toc">
          <p className="hf-agent-toc-title">Table of Contents</p>
          <ol className="hf-agent-toc-list">
            {[
              ['#step-1', 'Install BridgeKitty MCP'],
              ['#step-2', 'What can your agent do'],
              ['#step-3', 'Set up your agent wallet'],
              ['#step-4', 'Move assets across networks'],
              ['#step-5', 'Explore with your agent'],
              ['#enables', 'What BridgeKitty MCP enables'],
              ['#wrapping', 'Before wrapping up'],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="hf-agent-toc-link">
                  <ChevronRight size={12} />
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* ── Step 1: Install ──────────────────────────────── */}
        <div className="hf-agent-section" id="step-1">
          <div className="hf-agent-section-header">
            <Terminal size={15} />
            <h3>Step 1: Install BridgeKitty MCP</h3>
          </div>
          <p className="hf-agent-section-desc">Let's get your agent connected.</p>

          <PromptBlock text="Install the @persistenceone/bridgekitty package using npm i, then verify the connection." />

          <div className="hf-agent-install-block">
            <CodeBlock lang="bash" code="npm i @persistenceone/bridgekitty" />
          </div>

          <p className="hf-agent-section-desc" style={{ marginTop: '1rem' }}>
            Or connect directly via the live HTTP MCP endpoint — no install needed:
          </p>

          <div className="hf-agent-endpoint">
            <span className="hf-agent-endpoint-url">{MCP_URL}</span>
            <CopyButton text={MCP_URL} />
          </div>
          <div className="hf-agent-endpoint-meta">
            <span className="hf-agent-badge hf-agent-badge-green">Live</span>
            <span className="hf-agent-badge">Streamable HTTP</span>
            <span className="hf-agent-badge">No API key</span>
          </div>

          {/* Setup tabs */}
          <div className="hf-agent-tabs" style={{ marginTop: '1.25rem' }}>
            {([
              ['claude-desktop', 'Claude Desktop'],
              ['claude-code',    'Claude Code'],
              ['http',           'Any HTTP Agent'],
            ] as [SetupTab, string][]).map(([id, label]) => (
              <button
                key={id}
                className={`hf-agent-tab ${tab === id ? 'hf-agent-tab-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'claude-desktop' && (
            <div className="hf-agent-tab-content">
              <Step n={1} title="Find your config file">
                <div className="hf-agent-os-paths">
                  <div>
                    <span className="hf-agent-os-label">macOS</span>
                    <CodeBlock code="~/Library/Application Support/Claude/claude_desktop_config.json" />
                  </div>
                  <div>
                    <span className="hf-agent-os-label">Windows</span>
                    <CodeBlock code="%APPDATA%\Claude\claude_desktop_config.json" />
                  </div>
                </div>
              </Step>
              <Step n={2} title="Add the BridgeKitty server">
                <CodeBlock lang="json" code={`{
  "mcpServers": {
    "bridgekitty": {
      "type": "http",
      "url": "https://mcp.bridgekitty.xyz/mcp"
    }
  }
}`} />
              </Step>
              <Step n={3} title="Restart Claude Desktop fully">
                <p className="hf-agent-hint">Once loaded, look for the hammer icon (🔨) near the chat input — all 7 BridgeKitty tools will be listed there.</p>
              </Step>
            </div>
          )}

          {tab === 'claude-code' && (
            <div className="hf-agent-tab-content">
              <Step n={1} title="Add globally via CLI">
                <CodeBlock lang="bash" code="claude mcp add --transport http bridgekitty https://mcp.bridgekitty.xyz/mcp" />
                <p className="hf-agent-hint">Runs once per machine. Works across all your Claude Code sessions.</p>
              </Step>
              <Step n={2} title="Or add per-project">
                <p>Create <code>.claude/settings.json</code> in your project root:</p>
                <CodeBlock lang="json" code={`{
  "mcpServers": {
    "bridgekitty": {
      "type": "http",
      "url": "https://mcp.bridgekitty.xyz/mcp"
    }
  }
}`} />
              </Step>
              <Step n={3} title="Verify">
                <CodeBlock lang="bash" code="claude mcp list" />
                <p>You should see <code>bridgekitty</code> with a <strong>connected</strong> status.</p>
              </Step>
            </div>
          )}

          {tab === 'http' && (
            <div className="hf-agent-tab-content">
              <Step n={1} title="Required headers">
                <CodeBlock lang="http" code={`Content-Type: application/json
Accept: application/json, text/event-stream`} />
                <p className="hf-agent-hint">The <code>Accept</code> header is the one people usually miss.</p>
              </Step>
              <Step n={2} title="List all tools">
                <CodeBlock lang="bash" code={`curl -X POST https://mcp.bridgekitty.xyz/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`} />
              </Step>
              <Step n={3} title="Call a tool">
                <CodeBlock lang="bash" code={`curl -X POST https://mcp.bridgekitty.xyz/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": { "name": "check_health", "arguments": {} }
  }'`} />
              </Step>
            </div>
          )}

          <p className="hf-agent-hint" style={{ marginTop: '0.75rem' }}>
            Once this is done, your agent is ready to start interacting with BridgeKitty MCP.
          </p>
        </div>

        {/* ── Step 2: What it can do ───────────────────────── */}
        <div className="hf-agent-section" id="step-2">
          <div className="hf-agent-section-header">
            <Zap size={15} />
            <h3>Step 2: What Can Your Agent Do</h3>
          </div>
          <p className="hf-agent-section-desc">
            Now that BridgeKitty MCP is installed, let's understand what it can do.
          </p>
          <PromptBlock text="Tell me what I can do with BridgeKitty MCP in five points." />
          <p className="hf-agent-section-desc">
            Your agent will return a list of capabilities and actions it can perform across chains.
            This is the easiest way to get familiar before trying anything advanced. If something stands out, try it.
          </p>

          <div className="hf-agent-tools-grid" style={{ marginTop: '1rem' }}>
            {[
              { name: 'check_health',            desc: 'Ping the backend to make sure everything is up before doing anything else.' },
              { name: 'register_wallet',         desc: 'Register the wallet with BridgeKitty at the start of a session. Safe to call every time.' },
              { name: 'get_swap_quote',          desc: 'Get a cross-chain quote from LI.FI, Squid, deBridge, or Relay. Returns the full transaction payload ready to sign.' },
              { name: 'get_transaction_status',  desc: 'Check where a bridge is at. Call it on a loop until you see "completed" or "failed".' },
              { name: 'get_transaction_history', desc: "Pull a wallet's swap history — how many, what tokens, which chains, all of it." },
              { name: 'record_transaction',      desc: 'Once the user signs and the tx is broadcast, call this so it shows up in their history.' },
              { name: 'get_protocol_stats',      desc: 'Get swap volume and unique user stats for the last 7, 15, or 30 days.' },
            ].map(t => (
              <div key={t.name} className="hf-agent-tool-row">
                <code className="hf-agent-tool-name">{t.name}</code>
                <span className="hf-agent-tool-desc">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Step 3: Wallet setup ─────────────────────────── */}
        <div className="hf-agent-section" id="step-3">
          <div className="hf-agent-section-header">
            <Shield size={15} />
            <h3>Step 3: Set Up Your Agent Wallet</h3>
          </div>
          <p className="hf-agent-section-desc">
            Before doing anything on-chain, your agent needs a wallet. You don't have to create this manually.
          </p>
          <PromptBlock text="Create a fresh wallet for me and tell me where you'll store my keys securely" />
          <p className="hf-agent-section-desc" style={{ marginTop: '0.75rem' }}>Then:</p>
          <PromptBlock text="Tell me my wallet balances across chains" />
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

        {/* ── Step 4: Move assets ──────────────────────────── */}
        <div className="hf-agent-section" id="step-4">
          <div className="hf-agent-section-header">
            <Globe size={15} />
            <h3>Step 4: Move Assets Across Networks</h3>
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
          <p className="hf-agent-section-desc">
            No dashboards. No switching tabs. No manual routing.
          </p>

          {/* How signing works */}
          <div className="hf-agent-signing-flow" style={{ marginTop: '1.25rem' }}>
            <div className="hf-agent-signing-step">
              <div className="hf-agent-signing-num">1</div>
              <div>
                <strong>Agent calls <code>get_swap_quote</code></strong>
                <p>BridgeKitty hits LI.FI, Squid, deBridge, or Relay and returns a <code>transactionRequest</code> with destination, calldata, and gas estimates.</p>
              </div>
            </div>
            <div className="hf-agent-signing-arrow">↓</div>
            <div className="hf-agent-signing-step">
              <div className="hf-agent-signing-num">2</div>
              <div>
                <strong>Agent shows you what you're about to do</strong>
                <p>Amount out, fees, ETA. Asks for confirmation before anything moves.</p>
              </div>
            </div>
            <div className="hf-agent-signing-arrow">↓</div>
            <div className="hf-agent-signing-step hf-agent-signing-step-highlight">
              <div className="hf-agent-signing-num">3</div>
              <div>
                <strong>You sign — not the agent</strong>
                <p>The wallet popup appears. You click Confirm. The agent never sees the private key and cannot sign on your behalf.</p>
              </div>
            </div>
            <div className="hf-agent-signing-arrow">↓</div>
            <div className="hf-agent-signing-step">
              <div className="hf-agent-signing-num">4</div>
              <div>
                <strong>Agent tracks until settlement</strong>
                <p>Wallet returns a <code>txHash</code>. Agent calls <code>record_transaction</code>, then polls <code>get_transaction_status</code> until the bridge finishes.</p>
              </div>
            </div>
          </div>
          <p className="hf-agent-signing-note">
            <strong>Agents plan and track. Users approve and sign.</strong> Nothing moves without you explicitly confirming it in your wallet.
          </p>
        </div>

        {/* ── Step 5: Explore ──────────────────────────────── */}
        <div className="hf-agent-section" id="step-5">
          <div className="hf-agent-section-header">
            <Zap size={15} />
            <h3>Step 5: Explore With Your Agent</h3>
          </div>
          <p className="hf-agent-section-desc">
            Once you're comfortable, you can go deeper.
          </p>
          <PromptBlock text="How can I farm XPRT? What's my multiplier? Convert 0.01 ETH into staked XPRT so I can get a farming multiplier." />
          <p className="hf-agent-section-desc">
            BridgeKitty MCP allows your agent to interact directly with these workflows.
            This is where things start to feel different.
          </p>
        </div>

        {/* ── What it enables ──────────────────────────────── */}
        <div className="hf-agent-section" id="enables">
          <div className="hf-agent-section-header">
            <Zap size={15} />
            <h3>What BridgeKitty MCP Enables</h3>
          </div>
          <p className="hf-agent-section-desc">With BridgeKitty MCP, your agent can:</p>
          <div className="hf-agent-enables-grid">
            {[
              'Create wallets across supported chains',
              'Check balances across chains',
              'Move BTC assets between networks',
              'Bridge any asset with best-route quotes',
              'Track cross-chain transaction status',
              'Read swap history for any wallet',
              'Fetch protocol analytics and volume stats',
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

        {/* ── Before wrapping up ───────────────────────────── */}
        <div className="hf-agent-section hf-agent-closing" id="wrapping">
          <p className="hf-agent-closing-text">
            BridgeKitty MCP is early. But the direction is clear.
          </p>
          <p className="hf-agent-closing-text">
            AI agents won't just assist in DeFi. They'll operate within it.
            The experience needs to match that shift. BridgeKitty MCP is one step in that direction.
          </p>
          <p className="hf-agent-closing-cta">
            Try it. Break it. Push it further.
          </p>
          <p className="hf-agent-closing-text">We're excited to see what you prompt.</p>

          <div className="hf-agent-closing-links">
            <a href={BLOG_URL} target="_blank" rel="noopener noreferrer" className="hf-btn hf-btn-primary hf-agent-docs-btn">
              <ExternalLink size={14} />
              Full announcement post
            </a>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="hf-btn hf-btn-secondary">
              Join community chat
            </a>
          </div>
        </div>

        {/* ── Back ─────────────────────────────────────────── */}
        <div className="hf-agent-footer">
          <button className="hf-btn hf-btn-secondary" onClick={onBack}>
            Back to Homepage
          </button>
        </div>

      </div>
    </motion.main>
  );
}
