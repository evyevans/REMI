/* ═══════════════════════════════════════════════════════════
   SOLD LISTINGS TABLE — listings_sold table view
   Column spec per remi_listings_sold_blueprint.md Part 7
   ═══════════════════════════════════════════════════════════ */

import React from 'react';

// ─── Types ────────────────────────────────────────────────

interface AgentsStatus {
  ai_summary: 'idle' | 'running' | 'complete' | 'error';
  ai_investment_score: 'idle' | 'running' | 'complete' | 'error';
  ai_comp_analysis: 'idle' | 'running' | 'complete' | 'error';
}

interface SoldListing {
  id: string;
  market_slug: string;
  market_context: string;
  address: string;
  sold_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  property_type: 'house' | 'condo' | 'townhouse' | 'other' | null;
  listing_url: string | null;
  listing_agent: string | null;
  price_per_sqft: number | null;
  deal_score: number | null;
  deal_category: 'Excellent Deal' | 'Good Deal' | 'Fair Price' | 'Above Market' | 'High Price' | null;
  size_category: 'Small' | 'Medium' | 'Large' | 'Extra Large' | null;
  price_tier: 'Budget' | 'Starter' | 'Mid-Range' | 'Upper Mid' | 'Luxury' | 'Ultra Luxury' | null;
  last_synced: string | null;
  price_display: string | null;
  bed_bath: string | null;
  full_details: string | null;
  value_score_display: string | null;
  price_per_sqft_display: string | null;
  ai_summary: string | null;
  ai_investment_score: string | null;
  ai_comp_analysis: string | null;
  agents_status: AgentsStatus;
}

interface SoldListingsTableProps {
  listings: SoldListing[];
  onRunAgent: (propertyId: string, agents: string[]) => void;
}

// ─── Badge color maps ─────────────────────────────────────

const PROPERTY_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  house:     { bg: '#D4F1D4', text: '#1A6B1A' },
  condo:     { bg: '#D4E8F7', text: '#1A4A7A' },
  townhouse: { bg: '#F7E4D4', text: '#7A3A1A' },
  other:     { bg: '#E8E8E8', text: '#4A4A4A' },
};

const DEAL_CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Excellent Deal': { bg: '#1B8A3E', text: '#FFFFFF' },
  'Good Deal':      { bg: '#3DAB5E', text: '#FFFFFF' },
  'Fair Price':     { bg: '#F5C842', text: '#5A4500' },
  'Above Market':   { bg: '#E8822A', text: '#FFFFFF' },
  'High Price':     { bg: '#D63B3B', text: '#FFFFFF' },
};

const SIZE_CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Small':       { bg: '#F2D4E8', text: '#6B1A52' },
  'Medium':      { bg: '#E8D4F2', text: '#4A1A6B' },
  'Large':       { bg: '#F2E4C8', text: '#6B3D00' },
  'Extra Large': { bg: '#3A3A3A', text: '#FFFFFF' },
};

const PRICE_TIER_COLORS: Record<string, { bg: string; text: string }> = {
  'Budget':       { bg: '#D4D4D4', text: '#3A3A3A' },
  'Starter':      { bg: '#C8C0F0', text: '#2A1A7A' },
  'Mid-Range':    { bg: '#B8E8C0', text: '#1A5A28' },
  'Upper Mid':    { bg: '#C8E8C0', text: '#1A5A28' },
  'Luxury':       { bg: '#F0C8C0', text: '#7A1A1A' },
  'Ultra Luxury': { bg: '#E8354A', text: '#FFFFFF' },
};

// ─── Null render helper ───────────────────────────────────

function renderCell(value: unknown, type: 'currency' | 'number' | 'text' | 'badge'): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#D1D5DB' }}>—</span>;
  }
  if (type === 'currency') {
    return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (type === 'number') {
    return typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(value);
  }
  return String(value);
}

// ─── Badge renderer ───────────────────────────────────────

function Badge({
  value,
  colorMap,
}: {
  value: string | null;
  colorMap: Record<string, { bg: string; text: string }>;
}): React.ReactElement {
  if (!value) return <span style={{ color: '#D1D5DB' }}>—</span>;
  const colors = colorMap[value] ?? { bg: '#E8E8E8', text: '#4A4A4A' };
  return (
    <span
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </span>
  );
}

// ─── AI cell renderer ─────────────────────────────────────

function AICell({
  value,
  agentKey,
  agentsStatus,
  propertyId,
  onRunAgent,
}: {
  value: string | null;
  agentKey: keyof AgentsStatus;
  agentsStatus: AgentsStatus;
  propertyId: string;
  onRunAgent: (id: string, agents: string[]) => void;
}): React.ReactElement {
  const status = agentsStatus[agentKey] ?? 'idle';

  if (status === 'running') {
    return <span style={{ color: '#9CA3AF', fontSize: '12px', fontStyle: 'italic' }}>Analyzing...</span>;
  }
  if (status === 'complete' && value) {
    return (
      <span
        style={{
          fontSize: '12px',
          color: '#374151',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
        title={value}
      >
        {value}
      </span>
    );
  }
  if (status === 'error') {
    return (
      <button
        onClick={() => onRunAgent(propertyId, [agentKey])}
        style={{ color: '#D97706', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ⚠ Retry
      </button>
    );
  }
  // idle or partial
  return (
    <button
      onClick={() => onRunAgent(propertyId, [agentKey])}
      style={{ color: '#9CA3AF', fontSize: '12px', border: '1px solid #E5E7EB', padding: '2px 6px', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
    >
      Run agent
    </button>
  );
}

// ─── Column definitions ───────────────────────────────────

const COLUMN_WIDTHS: Record<string, number> = {
  address: 280,
  sold_price: 140,
  bedrooms: 100,
  bathrooms: 100,
  sqft: 110,
  property_type: 110,
  listing_url: 120,
  listing_agent: 200,
  price_per_sqft: 120,
  deal_score: 100,
  deal_category: 140,
  size_category: 120,
  price_tier: 120,
  last_synced: 160,
  price_display: 90,
  bed_bath: 100,
  full_details: 200,
  value_score_display: 100,
  price_per_sqft_display: 110,
  ai_summary: 200,
  ai_investment_score: 200,
  ai_comp_analysis: 200,
};

// ─── Main component ───────────────────────────────────────

export function SoldListingsTable({ listings, onRunAgent }: SoldListingsTableProps): React.ReactElement {
  const thStyle = (col: string): React.CSSProperties => ({
    width: COLUMN_WIDTHS[col],
    minWidth: COLUMN_WIDTHS[col],
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E5E7EB',
    whiteSpace: 'nowrap',
    background: '#F9FAFB',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  });

  const tdStyle = (col: string): React.CSSProperties => ({
    width: COLUMN_WIDTHS[col],
    minWidth: COLUMN_WIDTHS[col],
    maxWidth: COLUMN_WIDTHS[col],
    padding: '8px 12px',
    fontSize: '13px',
    color: '#111827',
    borderBottom: '1px solid #F3F4F6',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  });

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '75vh', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
      <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: 'max-content' }}>
        <thead>
          <tr>
            <th style={thStyle('address')}>Address</th>
            <th style={thStyle('sold_price')}>Sold Price</th>
            <th style={thStyle('bedrooms')}>Beds</th>
            <th style={thStyle('bathrooms')}>Baths</th>
            <th style={thStyle('sqft')}>Sqft</th>
            <th style={thStyle('property_type')}>Type</th>
            <th style={thStyle('listing_url')}>Listing</th>
            <th style={thStyle('listing_agent')}>Agent</th>
            <th style={thStyle('price_per_sqft')}>$/Sqft</th>
            <th style={thStyle('deal_score')}>Score</th>
            <th style={thStyle('deal_category')}>Deal</th>
            <th style={thStyle('size_category')}>Size</th>
            <th style={thStyle('price_tier')}>Tier</th>
            <th style={thStyle('last_synced')}>Last Synced</th>
            <th style={thStyle('price_display')}>Price</th>
            <th style={thStyle('bed_bath')}>Bed/Bath</th>
            <th style={thStyle('full_details')}>Details</th>
            <th style={thStyle('value_score_display')}>Value</th>
            <th style={thStyle('price_per_sqft_display')}>$/Sqft</th>
            <th style={thStyle('ai_summary')}>AI Summary</th>
            <th style={thStyle('ai_investment_score')}>AI Investment</th>
            <th style={thStyle('ai_comp_analysis')}>AI Comps</th>
          </tr>
        </thead>
        <tbody>
          {listings.map(listing => (
            <tr key={listing.id} style={{ background: 'white' }}>
              {/* 1. address */}
              <td style={{ ...tdStyle('address'), fontWeight: 500 }} title={listing.address}>
                {listing.address}
              </td>

              {/* 2. sold_price */}
              <td style={tdStyle('sold_price')}>
                {renderCell(listing.sold_price, 'currency')}
              </td>

              {/* 3. bedrooms */}
              <td style={tdStyle('bedrooms')}>
                {renderCell(listing.bedrooms, 'number')}
              </td>

              {/* 4. bathrooms */}
              <td style={tdStyle('bathrooms')}>
                {renderCell(listing.bathrooms, 'number')}
              </td>

              {/* 5. sqft */}
              <td style={tdStyle('sqft')}>
                {renderCell(listing.sqft, 'number')}
              </td>

              {/* 6. property_type badge */}
              <td style={tdStyle('property_type')}>
                <Badge value={listing.property_type} colorMap={PROPERTY_TYPE_COLORS} />
              </td>

              {/* 7. listing_url */}
              <td style={tdStyle('listing_url')}>
                {listing.listing_url
                  ? <a href={listing.listing_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', textDecoration: 'none', fontSize: '12px' }}>View</a>
                  : <span style={{ color: '#D1D5DB' }}>—</span>
                }
              </td>

              {/* 8. listing_agent */}
              <td style={tdStyle('listing_agent')} title={listing.listing_agent ?? ''}>
                {renderCell(listing.listing_agent, 'text')}
              </td>

              {/* 9. price_per_sqft */}
              <td style={tdStyle('price_per_sqft')}>
                {listing.price_per_sqft != null
                  ? `$${Math.round(listing.price_per_sqft).toLocaleString('en-US')}`
                  : <span style={{ color: '#D1D5DB' }}>—</span>
                }
              </td>

              {/* 10. deal_score */}
              <td style={tdStyle('deal_score')}>
                {renderCell(listing.deal_score, 'number')}
              </td>

              {/* 11. deal_category badge */}
              <td style={tdStyle('deal_category')}>
                <Badge value={listing.deal_category} colorMap={DEAL_CATEGORY_COLORS} />
              </td>

              {/* 12. size_category badge */}
              <td style={tdStyle('size_category')}>
                <Badge value={listing.size_category} colorMap={SIZE_CATEGORY_COLORS} />
              </td>

              {/* 13. price_tier badge */}
              <td style={tdStyle('price_tier')}>
                <Badge value={listing.price_tier} colorMap={PRICE_TIER_COLORS} />
              </td>

              {/* 14. last_synced */}
              <td style={tdStyle('last_synced')}>
                {listing.last_synced
                  ? new Date(listing.last_synced).toLocaleString('en-US', {
                      month: '2-digit', day: '2-digit', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })
                  : <span style={{ color: '#D1D5DB' }}>—</span>
                }
              </td>

              {/* 15. price_display */}
              <td style={tdStyle('price_display')}>
                {renderCell(listing.price_display, 'text')}
              </td>

              {/* 16. bed_bath */}
              <td style={tdStyle('bed_bath')}>
                {renderCell(listing.bed_bath, 'text')}
              </td>

              {/* 17. full_details */}
              <td style={tdStyle('full_details')} title={listing.full_details ?? ''}>
                {renderCell(listing.full_details, 'text')}
              </td>

              {/* 18. value_score_display */}
              <td style={tdStyle('value_score_display')}>
                {renderCell(listing.value_score_display, 'text')}
              </td>

              {/* 19. price_per_sqft_display */}
              <td style={tdStyle('price_per_sqft_display')}>
                {renderCell(listing.price_per_sqft_display, 'text')}
              </td>

              {/* 20. ai_summary */}
              <td style={{ ...tdStyle('ai_summary'), whiteSpace: 'normal' }}>
                <AICell
                  value={listing.ai_summary}
                  agentKey="ai_summary"
                  agentsStatus={listing.agents_status}
                  propertyId={listing.id}
                  onRunAgent={onRunAgent}
                />
              </td>

              {/* 21. ai_investment_score */}
              <td style={{ ...tdStyle('ai_investment_score'), whiteSpace: 'normal' }}>
                <AICell
                  value={listing.ai_investment_score}
                  agentKey="ai_investment_score"
                  agentsStatus={listing.agents_status}
                  propertyId={listing.id}
                  onRunAgent={onRunAgent}
                />
              </td>

              {/* 22. ai_comp_analysis */}
              <td style={{ ...tdStyle('ai_comp_analysis'), whiteSpace: 'normal' }}>
                <AICell
                  value={listing.ai_comp_analysis}
                  agentKey="ai_comp_analysis"
                  agentsStatus={listing.agents_status}
                  propertyId={listing.id}
                  onRunAgent={onRunAgent}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SoldListingsTable;
