
import React, { useEffect } from 'react';
import './panic-mode.css';

interface PanicMonitorProps {
    cpuTemp: number;
    isDeadManSwitchActive: boolean;
}

const PanicMonitor: React.FC<PanicMonitorProps> = ({ cpuTemp, isDeadManSwitchActive }) => {
    
    // Thresholds
    const CRITICAL_TEMP = 80.0; // 80 Degrees Celsius
    
    useEffect(() => {
        const body = document.body;
        const shouldPanic = cpuTemp > CRITICAL_TEMP || isDeadManSwitchActive;
        
        if (shouldPanic) {
            // ENGAGE PANIC
            body.classList.add('panic-state');
            // Audio Hazard Protocol would trigger here in a real app
        } else {
            // STAND DOWN
            body.classList.remove('panic-state');
        }

        // Cleanup: Always remove class when component unmounts to prevent "spill over"
        return () => {
            body.classList.remove('panic-state');
        };
        
    }, [cpuTemp, isDeadManSwitchActive]);

    return null; // This component has no visible UI, it controls global state
};

export default PanicMonitor;
