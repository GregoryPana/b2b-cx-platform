import React from 'react';
import {createRoot} from 'react-dom/client';
import InstallationAnalyticsView from './InstallationAnalyticsView';
import '../../styles/globals.css';
createRoot(document.getElementById('root')).render(<main style={{padding:24,maxWidth:1200,margin:'auto'}}><InstallationAnalyticsView analytics={{summary:{total_surveys:0}}} /></main>);
