import React from 'react';

/** Official Starlink map iframe + dark status card (mock metrics). */
const StarlinkMap: React.FC = () => {
  return (
    <div className="gp-brand-embed">
      <iframe
        className="gp-brand-map"
        src="https://www.starlink.com/map"
        title="Starlink Coverage Map"
      />
      <div className="gp-status-card" aria-label="Starlink status (illustrative)">
        <h3>Starlink coverage</h3>
        <p>Global availability map (embedded from starlink.com). Service and speeds vary by location.</p>
        <div className="gp-status-row">
          <span className="gp-status-k">Status</span>
          <span className="gp-status-v">Online (mock)</span>
        </div>
        <div className="gp-status-row">
          <span className="gp-status-k">Latency</span>
          <span className="gp-status-v">20 ms (mock)</span>
        </div>
      </div>
    </div>
  );
};

export default StarlinkMap;
