import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import PageContainer from "../components/layout/PageContainer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8001`;

const COLORS = {
  promoters: "#10b981",
  passives: "#f59e0b",
  detractors: "#ef4444",
  very_satisfied: "#10b981",
  satisfied: "#34d399",
  neutral: "#f59e0b",
  dissatisfied: "#fb7185",
  very_dissatisfied: "#ef4444",
};

export default function DashboardPage({ headers, activePlatform, setActivePlatform }) {
  const location = useLocation();
  const [surveyTypes, setSurveyTypes] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [questionAverages, setQuestionAverages] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [trendData, setTrendData] = useState([]);
  const [pendingVisits, setPendingVisits] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Reset selected question when platform changes
  useEffect(() => {
    setSelectedQuestionId("");
  }, [activePlatform]);

  // Load survey types on mount
  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API_BASE}/survey-types`, { headers });
      const data = await res.json();
      if (!res.ok) return;
      const values = Array.isArray(data) ? data : [];
      setSurveyTypes(values);
      if (!activePlatform && values[0]?.name) {
        setActivePlatform(values[0].name);
      }
    };
    load();
  }, [activePlatform, headers, setActivePlatform]);

  // Load core metrics (NPS, Coverage, Category Breakdown, CSAT)
  useEffect(() => {
    if (!activePlatform) return;
    const load = async () => {
      setError("");
      const params = new URLSearchParams();
      params.set("survey_type", activePlatform);
      if (fromDate) params.set("date_from", fromDate);
      if (toDate) params.set("date_to", toDate);
      params.set("_cb", Date.now().toString());
      const queryString = `?${params.toString()}`;

      try {
        const [npsRes, coverageRes, catRes, analyticsRes] = await Promise.all([
          fetch(`${API_BASE}/dashboard/nps${queryString}`, { headers }),
          fetch(`${API_BASE}/dashboard/coverage${queryString}`, { headers }),
          fetch(`${API_BASE}/dashboard/category-breakdown${queryString}`, { headers }),
          fetch(`${API_BASE}/analytics${queryString}`, { headers })
        ]);

        const npsData = await npsRes.json();
        const coverageData = await coverageRes.json();
        const catData = await catRes.json();
        const analyticsData = await analyticsRes.json();

        if (!npsRes.ok || !coverageRes.ok || !catRes.ok || !analyticsRes.ok) {
          setError(
            npsData.detail ||
            coverageData.detail ||
            catData.detail ||
            analyticsData.detail ||
            "Failed to load metrics"
          );
          return;
        }

        setAnalytics({
          nps: npsData,
          coverage: coverageData,
          category_breakdown: Array.isArray(catData) ? catData : [],
          customer_satisfaction: analyticsData.customer_satisfaction || analyticsData
        });
      } catch (err) {
        setError("Failed to load metrics");
      }
    };
    load();
  }, [activePlatform, fromDate, toDate, headers]);

  // Load question averages for drilldown table
  useEffect(() => {
    if (!activePlatform) return;
    const load = async () => {
      const params = new URLSearchParams({ survey_type: activePlatform });
      if (fromDate) params.set("date_from", fromDate);
      if (toDate) params.set("date_to", toDate);
      const res = await fetch(`${API_BASE}/analytics/questions?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) return;
      const values = Array.isArray(data) ? data : [];
      setQuestionAverages(values);
      // Auto-select first question if none selected
      if (!selectedQuestionId && values.length > 0 && values[0].question_id) {
        setSelectedQuestionId(String(values[0].question_id));
      }
    };
    load();
  }, [activePlatform, headers, fromDate, toDate]);

  // Load question trend data
  useEffect(() => {
    if (!selectedQuestionId || !activePlatform) return;
    const load = async () => {
      const params = new URLSearchParams({ survey_type: activePlatform, interval: "week" });
      if (fromDate) params.set("date_from", fromDate);
      if (toDate) params.set("date_to", toDate);
      const res = await fetch(`${API_BASE}/analytics/questions/${selectedQuestionId}/trend?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) return;
      const rows = Array.isArray(data?.series) ? data.series : [];
      setTrendData(rows.map((row) => ({ period: row.period_label || row.period, average: Number(row.average_score || 0) })));
    };
    load();
  }, [activePlatform, headers, selectedQuestionId, fromDate, toDate]);

  // Load pending visits for review queue
  useEffect(() => {
    const load = async () => {
      const params = new URLSearchParams();
      params.set("status", "Pending");
      if (activePlatform) params.set("survey_type", activePlatform);
      const res = await fetch(`${API_BASE}/dashboard-visits/all?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load pending visits");
        return;
      }
      const normalized = (Array.isArray(data) ? data : []).map((visit) => ({
        ...visit,
        visit_id: visit.visit_id ?? visit.id,
      }));
      setPendingVisits(normalized);
    };
    load();
  }, [headers, activePlatform]);

  // Load businesses
  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API_BASE}/api/b2b/public/businesses`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load businesses");
        return;
      }
      setBusinesses(Array.isArray(data) ? data : []);
    };
    load();
  }, [headers]);

   const analyticsCards = [
     { title: "NPS", value: analytics?.nps?.nps ?? "--" },
     { title: "CSAT", value: `${analytics?.customer_satisfaction?.csat_score?.toFixed?.(1) ?? "--"}%` },
     { title: "Coverage", value: `${analytics?.coverage?.coverage_percent ?? "--"}%` },
     { title: "Responses", value: analytics?.nps?.total_responses ?? 0 },
   ];

   // Prepare NPS pie data
   const npsPieData = useMemo(() => {
     const nps = analytics?.nps;
     if (!nps) return [];
     return [
       { name: "Promoters", value: nps.promoters || 0, color: COLORS.promoters },
       { name: "Passives", value: nps.passives || 0, color: COLORS.passives },
       { name: "Detractors", value: nps.detractors || 0, color: COLORS.detractors },
     ];
   }, [analytics]);

   // Prepare CSAT pie data
   const csatPieData = useMemo(() => {
     const csat = analytics?.customer_satisfaction?.score_distribution;
     if (!csat) return [];
     return [
       { name: "Very Satisfied", value: csat.very_satisfied || 0, color: COLORS.very_satisfied },
       { name: "Satisfied", value: csat.satisfied || 0, color: COLORS.satisfied },
       { name: "Neutral", value: csat.neutral || 0, color: COLORS.neutral },
       { name: "Dissatisfied", value: csat.dissatisfied || 0, color: COLORS.dissatisfied },
       { name: "Very Dissatisfied", value: csat.very_dissatisfied || 0, color: COLORS.very_dissatisfied },
     ];
   }, [analytics]);

   return (
    <PageContainer>
      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded">
          {error}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">CX Dashboard Blueprint</h2>
          <p className="text-muted-foreground">New implementation based on the blueprint with backend wiring retained.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
          <Select value={activePlatform || ""} onChange={(event) => setActivePlatform(event.target.value)}>
            {surveyTypes.map((type) => (
              <option key={type.id || type.name} value={type.name}>{type.name}</option>
            ))}
          </Select>
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <Button variant="outline" onClick={() => { setFromDate(""); setToDate(""); }}>Reset</Button>
        </div>
      </div>

      {location.pathname === "/" ? (
        <>
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {analyticsCards.map((card) => (
              <Card key={card.title} className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <CardHeader className="pb-2">
                  <CardDescription>{card.title}</CardDescription>
                  <CardTitle className="text-3xl">{card.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <CardHeader>
                <CardTitle>Question Trend</CardTitle>
                <Select value={selectedQuestionId} onChange={(event) => setSelectedQuestionId(event.target.value)}>
                  {questionAverages.map((question) => (
                    <option key={question.question_id} value={question.question_id}>
                      {question.question_text}
                    </option>
                  ))}
                </Select>
              </CardHeader>
              <CardContent className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="average" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(analytics?.category_breakdown || []).map((item) => (
                  <div key={item.category} className="flex items-center justify-between rounded-md bg-muted p-2">
                    <span className="text-sm">{item.category}</span>
                    <Badge>{Number(item.average_score || 0).toFixed(2)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Detailed NPS and CSAT Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 mt-6">
            {/* NPS Card */}
            <Card className="lg:col-span-6">
              <CardHeader>
                <CardTitle>Net Promoter Score</CardTitle>
                <CardDescription>
                  {analytics?.nps?.total_responses ?? 0} approved responses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <div className="text-6xl font-bold mb-4" style={{ color: "hsl(var(--primary))" }}>
                    {analytics?.nps?.nps ?? "--"}
                  </div>
                  
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={npsPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {npsPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, "Count"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.promoters }}></div>
                      <span className="text-sm">Promoters: {analytics?.nps?.promoters ?? 0} ({analytics?.nps?.promoter_percentage ?? 0}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.passives }}></div>
                      <span className="text-sm">Passives: {analytics?.nps?.passives ?? 0} ({analytics?.nps?.passive_percentage ?? 0}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.detractors }}></div>
                      <span className="text-sm">Detractors: {analytics?.nps?.detractors ?? 0} ({analytics?.nps?.detractor_percentage ?? 0}%)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CSAT Card */}
            <Card className="lg:col-span-6">
              <CardHeader>
                <CardTitle>Customer Satisfaction</CardTitle>
                <CardDescription>
                  {analytics?.customer_satisfaction?.response_count ?? 0} responses to satisfaction question
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <div className="text-6xl font-bold mb-4" style={{ color: "hsl(var(--primary))" }}>
                    {analytics?.customer_satisfaction?.csat_score?.toFixed?.(1) ?? "--"}%
                  </div>
                  
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={csatPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {csatPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, "Count"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.very_satisfied }}></div>
                      <span className="text-xs">Very Sat: {analytics?.customer_satisfaction?.score_distribution?.very_satisfied ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.satisfied }}></div>
                      <span className="text-xs">Sat: {analytics?.customer_satisfaction?.score_distribution?.satisfied ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.neutral }}></div>
                      <span className="text-xs">Neutral: {analytics?.customer_satisfaction?.score_distribution?.neutral ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.dissatisfied }}></div>
                      <span className="text-xs">Dissat: {analytics?.customer_satisfaction?.score_distribution?.dissatisfied ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.very_dissatisfied }}></div>
                      <span className="text-xs">Very Dissat: {analytics?.customer_satisfaction?.score_distribution?.very_dissatisfied ?? 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {location.pathname === "/trends" ? (
        <Card>
          <CardHeader>
            <CardTitle>Trend Explorer</CardTitle>
            <CardDescription>Weekly progression for selected questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedQuestionId} onChange={(event) => setSelectedQuestionId(event.target.value)}>
              {questionAverages.map((question) => (
                <option key={question.question_id} value={question.question_id}>{question.question_text}</option>
              ))}
            </Select>
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="average" stroke="hsl(var(--primary))" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {location.pathname === "/review" ? (
        <Card>
          <CardHeader>
            <CardTitle>Review Queue</CardTitle>
            <CardDescription>Pending visits waiting for review.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visit ID</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingVisits.map((visit) => (
                  <TableRow key={visit.id || visit.visit_id}>
                    <TableCell>{visit.id || visit.visit_id}</TableCell>
                    <TableCell>{visit.business_name || "--"}</TableCell>
                    <TableCell>{visit.visit_date || "--"}</TableCell>
                    <TableCell><Badge variant="warning">{visit.status || "Pending"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {location.pathname === "/businesses" ? (
        <Card>
          <CardHeader>
            <CardTitle>Businesses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input placeholder="Filter by name" value={status} onChange={(event) => setStatus(event.target.value)} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses
                  .filter((business) => business.name?.toLowerCase().includes(status.toLowerCase()))
                  .map((business) => (
                    <TableRow key={business.id}>
                      <TableCell>{business.name}</TableCell>
                      <TableCell>{business.location || "--"}</TableCell>
                      <TableCell><Badge variant="secondary">{business.priority_level || "medium"}</Badge></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </PageContainer>
  );
}
