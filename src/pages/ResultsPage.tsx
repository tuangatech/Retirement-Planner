// src/pages/ResultsPage.tsx

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useResults } from '@/contexts/ResultsContext'
import { useInputs } from '@/contexts/InputsContext'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Activity, GitCompare } from 'lucide-react'
import { SummaryDashboard } from '@/components/results/SummaryDashboard'
import MonteCarloChart from '@/components/results/MonteCarloChart'
import CashFlowChart from '@/components/results/CashFlowChart'
import AnnualTable from '@/components/results/AnnualTable'
import AssumptionsPanel from '@/components/results/AssumptionsPanel'
import { ScenarioStorage, loadScenario } from '@/lib/storage/scenarioStorage'
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer'; 
import { Button } from '@/components/ui/button';

export default function ResultsPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams();
    const { results, isCalculating, error, setResults } = useResults()
    const { inputs, loadFromScenario, currentScenarioId } = useInputs()

    const [scenarioCount, setScenarioCount] = useState(() => ScenarioStorage.getAllScenarios().length);

    useEffect(() => {
        const scenarioId = searchParams.get('scenarioId');

        if (scenarioId) {
            const scenario = loadScenario(scenarioId);

            if (!scenario) {
                navigate('/scenarios');
                return;
            }

            loadFromScenario(scenario.id, scenario.name, scenario.inputs);

            if (scenario.results) {
                setResults(scenario.results);
            } else {
                navigate('/wizard/6');
            }
        } else if (!results && !isCalculating && !error) {
            navigate('/wizard/1');
        }
    }, [searchParams]);

    useEffect(() => {
        setScenarioCount(ScenarioStorage.getAllScenarios().length);
    }, [currentScenarioId]);

    const handleCompareWith = () => {
        if (currentScenarioId) {
            navigate(`/scenarios?compare=${currentScenarioId}`)
        } else {
            navigate('/scenarios')
        }
    }

    useEffect(() => {
        window.scrollTo(0, 0); // Instant scroll to top
    }, []); // Run once on mount

    if (isCalculating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
                <Header variant="results" />
                <div className="w-full max-w-6xl mx-auto px-4 py-8 flex-1">
                    <Card>
                        <CardContent className="flex items-center justify-center py-12">
                            <div className="text-center space-y-4">
                                <Activity className="h-12 w-12 animate-spin mx-auto text-primary" />
                                <p className="text-lg font-medium">Running Monte Carlo simulation...</p>
                                <p className="text-sm text-muted-foreground">
                                    This may take a moment as we analyze {inputs.simulation.numberOfRuns.toLocaleString() || '1,000'} scenarios
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <Footer />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
                <Header variant="results" />
                <div className="w-full max-w-6xl mx-auto px-4 py-8 flex-1">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <div className="space-y-2">
                                <p className="font-medium">Calculation Error</p>
                                <p>{error}</p>
                                <Button onClick={() => navigate('/wizard/6')} variant="outline" size="sm" className="mt-2">
                                    Return to Wizard
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                </div>
                <Footer />
            </div>
        )
    }

    if (!results) return null

    const successRate = results.successRate * 100

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
            <Header variant="results" />

            <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-6 flex-1">
                {/* ✅ CRITICAL ALERTS - HIGHEST PRIORITY - ABOVE ALL OTHER CONTENT */}
                {successRate < 50 && (
                    <Alert variant="destructive" className="border-2">
                        <AlertCircle className="h-5 w-5" />
                        <AlertDescription>
                            <p className="font-semibold mb-1">
                                ⚠️ CRITICAL: Your plan has a {successRate.toFixed(1)}% success rate ({results.failedRuns.count.toLocaleString()} of {results.numberOfRuns.toLocaleString()} scenarios failed)
                            </p>
                            <p className="text-sm">
                                Your portfolio runs out of money in {(100 - successRate).toFixed(1)}% of scenarios.
                                {results.failedRuns.medianAgeOfDepletion && (
                                    <> The median depletion age is <strong>age {results.failedRuns.medianAgeOfDepletion}</strong>,
                                        leaving you {inputs.personal.lifeExpectancy - results.failedRuns.medianAgeOfDepletion} years underfunded.</>
                                )}
                                {' '}Major adjustments are needed: consider delaying retirement, reducing expenses, or increasing savings.
                            </p>
                        </AlertDescription>
                    </Alert>
                )}

                {successRate >= 50 && successRate < 70 && (
                    <Alert className="border-2 border-yellow-500">
                        <AlertCircle className="h-5 w-5" />
                        <AlertDescription>
                            <p className="font-semibold mb-1">
                                ⚡ HIGH RISK: Your plan has a {successRate.toFixed(1)}% success rate
                            </p>
                            <p className="text-sm">
                                {(100 - successRate).toFixed(1)}% chance of portfolio depletion.
                                {results.failedRuns.medianAgeOfDepletion && (
                                    <> Failed scenarios typically deplete at age {results.failedRuns.medianAgeOfDepletion}.</>
                                )}
                                {' '}Consider adjustments to improve your plan's viability.
                            </p>
                        </AlertDescription>
                    </Alert>
                )}

                {successRate >= 70 && successRate < 90 && (
                    <Alert className="border-2 border-yellow-500">
                        <AlertCircle className="h-5 w-5" />
                        <AlertDescription>
                            Your plan has a {successRate.toFixed(1)}% success rate. This is acceptable but leaves some risk.
                            Consider small adjustments for additional security.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Comparison banner - Secondary priority */}
                {scenarioCount >= 2 && currentScenarioId && (
                    <Alert className="border-2 border-blue-500 bg-blue-50">
                        <GitCompare className="h-5 w-5 text-blue-600" />
                        <AlertDescription>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-blue-900 mb-1">
                                        Compare this scenario with another
                                    </p>
                                    <p className="text-sm text-blue-800">
                                        You have {scenarioCount - 1} other saved scenario{scenarioCount > 2 ? 's' : ''} to compare with.
                                    </p>
                                </div>
                                <Button
                                    onClick={handleCompareWith}
                                    variant="outline"
                                    size="sm"
                                    className="ml-4 border-blue-600 text-blue-600 hover:bg-blue-100"
                                >
                                    <GitCompare className="h-4 w-4 mr-2" />
                                    Compare with...
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Visualizations Tabs */}
                <Tabs defaultValue="summary" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="monte-carlo">Monte Carlo</TabsTrigger>
                        <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
                        <TabsTrigger value="breakdown">Annual Breakdown</TabsTrigger>
                        <TabsTrigger value="assumptions">Disclosures</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="space-y-4">
                        <SummaryDashboard results={results} inputs={inputs} />
                    </TabsContent>

                    <TabsContent value="monte-carlo" className="space-y-4">
                        <Card>
                            <CardContent className="pt-6">
                                <MonteCarloChart results={results} inputs={inputs} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="cash-flow" className="space-y-4">
                        <Card>
                            <CardContent className="pt-6">
                                <CashFlowChart results={results} inputs={inputs} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="breakdown" className="space-y-4">
                        <Card>
                            <CardContent className="pt-6">
                                <AnnualTable results={results} inputs={inputs} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="assumptions" className="space-y-4">
                        <AssumptionsPanel inputs={inputs} />
                    </TabsContent>
                </Tabs>
            </div>

            <Footer />
        </div>
    )
}