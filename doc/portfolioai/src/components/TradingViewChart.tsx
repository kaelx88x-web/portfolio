import React, { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  symbol?: string;
  theme?: 'light' | 'dark';
}

const TradingViewChart: React.FC<TradingViewWidgetProps> = ({ symbol = "NASDAQ:AAPL", theme = 'dark' }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentContainer = container.current;
    if (!currentContainer) return;
    
    // Clear previous widget content
    currentContainer.innerHTML = '';
    
    // Create the required inner div that TradingView often looks for
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    currentContainer.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    
    const config = {
      "autosize": true,
      "symbol": symbol,
      "interval": "D",
      "timezone": "Etc/UTC",
      "theme": theme,
      "style": "1",
      "locale": "en",
      "enable_publishing": false,
      "allow_symbol_change": true,
      "calendar": false,
      "support_host": "https://www.tradingview.com",
      "backgroundColor": theme === 'dark' ? "#0a0b14" : "#f8fafc",
      "gridColor": theme === 'dark' ? "rgba(30, 41, 59, 0.5)" : "rgba(226, 232, 240, 0.8)",
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
      "container_id": "tradingview_chart"
    };

    script.innerHTML = JSON.stringify(config);
    currentContainer.appendChild(script);

    return () => {
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }
    };
  }, [symbol, theme]);

  return (
    <div 
      className="tradingview-widget-container h-full w-full" 
      ref={container} 
      style={{ 
        height: "100%", 
        width: "100%",
        backgroundColor: theme === 'dark' ? "#0a0b14" : "#f8fafc"
      }}
    >
    </div>
  );
};

export default memo(TradingViewChart);
