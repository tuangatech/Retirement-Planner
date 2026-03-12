// src/lib/analytics.ts - Privacy-First Analytics Tracking

/**
 * Analytics Tracking System
 * 
 * PRIVACY-FIRST DESIGN:
 * - No external services (Google Analytics, Mixpanel, etc.)
 * - All data stored locally in browser
 * - Optional server sync for aggregate metrics (anonymized)
 * - User can view/export/delete their own analytics data
 * - No PII (Personally Identifiable Information) collected
 * 
 * WHAT WE TRACK:
 * - Page views (landing, wizard steps, results)
 * - Button clicks (Start Planning, Calculate, Export)
 * - Wizard progression (step completion, time per step)
 * - Calculation success/errors
 * - Feature usage (CSV export, scenario save)
 * 
 * WHAT WE DON'T TRACK:
 * - Financial data (balances, income, expenses)
 * - Personal information (name, email, age)
 * - Browser fingerprinting
 * - Cross-site tracking
 */

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export interface AnalyticsEvent {
    id: string;
    timestamp: number;
    eventType:
    | 'page_view'
    | 'button_click'
    | 'wizard_step_complete'
    | 'calculation_start'
    | 'calculation_complete'
    | 'calculation_error'
    | 'csv_export'
    | 'profile_save'
    | 'profile_load';
    eventData: Record<string, any>;
    sessionId: string;
}

export interface AnalyticsSession {
    sessionId: string;
    startTime: number;
    lastActivityTime: number;
    events: AnalyticsEvent[];
}

export interface WizardStepMetrics {
    step: number;
    startTime: number;
    endTime: number | null;
    completedAt: number | null;
    timeSpent: number | null; // milliseconds
}

export interface AnalyticsSummary {
    totalSessions: number;
    totalEvents: number;
    wizardStarted: number;
    wizardCompleted: number;
    calculationsRun: number;
    averageStepTime: Record<number, number>; // step -> avg milliseconds
    completionRate: number; // percentage
    exportCount: number;
    profileSaveCount: number;
}

// ===================================================================
// LOCAL STORAGE KEYS
// ===================================================================

const STORAGE_KEYS = {
    SESSION_ID: 'analytics_session_id',
    EVENTS: 'analytics_events',
    WIZARD_PROGRESS: 'analytics_wizard_progress',
    LAST_SYNC: 'analytics_last_sync',
} as const;

// ===================================================================
// SESSION MANAGEMENT
// ===================================================================

/**
 * Gets or creates a session ID for this user session
 */
function getSessionId(): string {
    let sessionId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);

    if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    }

    return sessionId;
}

// ===================================================================
// EVENT TRACKING
// ===================================================================

/**
 * Tracks an analytics event locally
 */
export function trackEvent(
    eventType: AnalyticsEvent['eventType'],
    eventData: Record<string, any> = {}
): void {
    try {
        const event: AnalyticsEvent = {
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            eventType,
            eventData,
            sessionId: getSessionId(),
        };

        // Get existing events
        const eventsJson = localStorage.getItem(STORAGE_KEYS.EVENTS);
        const events: AnalyticsEvent[] = eventsJson ? JSON.parse(eventsJson) : [];

        // Add new event
        events.push(event);

        // Keep only last 1000 events (prevent localStorage overflow)
        const recentEvents = events.slice(-1000);

        // Save back to localStorage
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(recentEvents));

        // Optional: Log in development
        if (process.env.NODE_ENV === 'development') {
            console.log('[Analytics]', eventType, eventData);
        }
    } catch (error) {
        console.error('Failed to track event:', error);
    }
}

// ===================================================================
// SPECIFIC EVENT TRACKERS
// ===================================================================

/**
 * Track page view
 */
export function trackPageView(page: string, additionalData?: Record<string, any>): void {
    trackEvent('page_view', {
        page,
        path: window.location.pathname,
        referrer: document.referrer,
        ...additionalData,
    });
}

/**
 * Track button click
 */
export function trackButtonClick(buttonName: string, location: string): void {
    trackEvent('button_click', {
        buttonName,
        location,
        path: window.location.pathname,
    });
}

/**
 * Track wizard step completion
 */
export function trackWizardStep(step: number, timeSpent: number): void {
    trackEvent('wizard_step_complete', {
        step,
        timeSpent, // milliseconds
        timeSpentSeconds: Math.round(timeSpent / 1000),
    });

    // Update wizard progress in localStorage
    updateWizardProgress(step, timeSpent);
}

/**
 * Track calculation start
 */
export function trackCalculationStart(numberOfRuns: number): void {
    trackEvent('calculation_start', {
        numberOfRuns,
        startTime: Date.now(),
    });
}

/**
 * Track calculation completion
 */
export function trackCalculationComplete(
    numberOfRuns: number,
    duration: number,
    successRate: number
): void {
    trackEvent('calculation_complete', {
        numberOfRuns,
        duration, // milliseconds
        durationSeconds: Math.round(duration / 1000),
        successRate,
    });
}

/**
 * Track calculation error
 */
export function trackCalculationError(error: string): void {
    trackEvent('calculation_error', {
        error,
        timestamp: Date.now(),
    });
}

/**
 * Track CSV export
 */
export function trackCSVExport(percentile: string): void {
    trackEvent('csv_export', {
        percentile,
        timestamp: Date.now(),
    });
}

/**
 * Track profile save
 */
export function trackProfileSave(profileName?: string): void {
    trackEvent('profile_save', {
        hasName: !!profileName,
        timestamp: Date.now(),
    });
}

/**
 * Track profile load
 */
export function trackProfileLoad(): void {
    trackEvent('profile_load', {
        timestamp: Date.now(),
    });
}

// ===================================================================
// WIZARD PROGRESS TRACKING
// ===================================================================

interface WizardProgress {
    [sessionId: string]: {
        steps: WizardStepMetrics[];
        completed: boolean;
        startTime: number;
        endTime: number | null;
    };
}

/**
 * Update wizard progress for current session
 */
function updateWizardProgress(step: number, timeSpent: number): void {
    try {
        const sessionId = getSessionId();
        const progressJson = localStorage.getItem(STORAGE_KEYS.WIZARD_PROGRESS);
        const progress: WizardProgress = progressJson ? JSON.parse(progressJson) : {};

        if (!progress[sessionId]) {
            progress[sessionId] = {
                steps: [],
                completed: false,
                startTime: Date.now(),
                endTime: null,
            };
        }

        // Add step metrics
        progress[sessionId].steps.push({
            step,
            startTime: Date.now() - timeSpent,
            endTime: Date.now(),
            completedAt: Date.now(),
            timeSpent,
        });

        // Check if wizard completed (step 6)
        if (step === 6) {
            progress[sessionId].completed = true;
            progress[sessionId].endTime = Date.now();
        }

        localStorage.setItem(STORAGE_KEYS.WIZARD_PROGRESS, JSON.stringify(progress));
    } catch (error) {
        console.error('Failed to update wizard progress:', error);
    }
}

// ===================================================================
// ANALYTICS RETRIEVAL & ANALYSIS
// ===================================================================

/**
 * Get all analytics events from localStorage
 */
export function getAllEvents(): AnalyticsEvent[] {
    try {
        const eventsJson = localStorage.getItem(STORAGE_KEYS.EVENTS);
        return eventsJson ? JSON.parse(eventsJson) : [];
    } catch (error) {
        console.error('Failed to retrieve events:', error);
        return [];
    }
}

/**
 * Get analytics summary
 */
export function getAnalyticsSummary(): AnalyticsSummary {
    const events = getAllEvents();
    const progressJson = localStorage.getItem(STORAGE_KEYS.WIZARD_PROGRESS);
    const progress: WizardProgress = progressJson ? JSON.parse(progressJson) : {};

    // Count unique sessions
    const uniqueSessions = new Set(events.map(e => e.sessionId));

    // Count wizard completions
    const wizardStarted = Object.keys(progress).length;
    const wizardCompleted = Object.values(progress).filter(p => p.completed).length;

    // Count calculations
    const calculationsRun = events.filter(e => e.eventType === 'calculation_complete').length;

    // Calculate average step time
    const stepTimes: Record<number, number[]> = {};
    Object.values(progress).forEach(session => {
        session.steps.forEach(step => {
            if (step.timeSpent) {
                if (!stepTimes[step.step]) {
                    stepTimes[step.step] = [];
                }
                stepTimes[step.step].push(step.timeSpent);
            }
        });
    });

    const averageStepTime: Record<number, number> = {};
    Object.entries(stepTimes).forEach(([step, times]) => {
        averageStepTime[Number(step)] = times.reduce((a, b) => a + b, 0) / times.length;
    });

    // Completion rate
    const completionRate = wizardStarted > 0 ? (wizardCompleted / wizardStarted) * 100 : 0;

    // Count exports and saves
    const exportCount = events.filter(e => e.eventType === 'csv_export').length;
    const profileSaveCount = events.filter(e => e.eventType === 'profile_save').length;

    return {
        totalSessions: uniqueSessions.size,
        totalEvents: events.length,
        wizardStarted,
        wizardCompleted,
        calculationsRun,
        averageStepTime,
        completionRate,
        exportCount,
        profileSaveCount,
    };
}

/**
 * Export analytics data as JSON
 */
export function exportAnalyticsData(): string {
    const events = getAllEvents();
    const summary = getAnalyticsSummary();

    return JSON.stringify({
        summary,
        events,
        exportedAt: new Date().toISOString(),
    }, null, 2);
}

/**
 * Clear all analytics data
 */
export function clearAnalyticsData(): void {
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.WIZARD_PROGRESS);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_ID);
}

// ===================================================================
// OPTIONAL: SERVER SYNC (AGGREGATE METRICS ONLY)
// ===================================================================

/**
 * Sync anonymized aggregate metrics to server
 * 
 * NOTE: This function is OPTIONAL and only syncs aggregate, anonymized data
 * No individual events or PII are sent to the server
 * 
 * Server endpoint should accept POST requests with this structure:
 * {
 *   summary: AnalyticsSummary,
 *   timestamp: number,
 *   version: string
 * }
 */
export async function syncAggregateMetrics(serverUrl?: string): Promise<void> {
    if (!serverUrl) {
        console.warn('No server URL provided for analytics sync');
        return;
    }

    try {
        const summary = getAnalyticsSummary();

        // Only sync if there's meaningful data
        if (summary.totalEvents === 0) {
            return;
        }

        const payload = {
            summary,
            timestamp: Date.now(),
            version: '1.0.0',
        };

        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        // Record last sync time
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());

        console.log('Analytics synced successfully');
    } catch (error) {
        console.error('Failed to sync analytics:', error);
    }
}

// ===================================================================
// REACT HOOKS (OPTIONAL)
// ===================================================================

// /**
//  * React hook for tracking page views automatically
//  * 
//  * Usage:
//  * function MyPage() {
//  *   usePageTracking('landing');
//  *   return <div>...</div>;
//  * }
//  */
// export function usePageTracking(pageName: string): void {
//     React.useEffect(() => {
//         trackPageView(pageName);
//     }, [pageName]);
// }

// /**
//  * React hook for tracking wizard step progression
//  * 
//  * Usage:
//  * function WizardPage() {
//  *   const [currentStep, setCurrentStep] = useState(1);
//  *   useWizardStepTracking(currentStep);
//  *   return <div>...</div>;
//  * }
//  */
// export function useWizardStepTracking(currentStep: number): void {
//     const startTimeRef = React.useRef<number>(Date.now());
//     const previousStepRef = React.useRef<number>(currentStep);

//     React.useEffect(() => {
//         // Track when step changes (user moved to next step)
//         if (currentStep !== previousStepRef.current && previousStepRef.current !== 0) {
//             const timeSpent = Date.now() - startTimeRef.current;
//             trackWizardStep(previousStepRef.current, timeSpent);
//             startTimeRef.current = Date.now();
//         }

//         previousStepRef.current = currentStep;
//     }, [currentStep]);
// }

// // Import React for hooks (only if using React hooks above)
// import React from 'react';