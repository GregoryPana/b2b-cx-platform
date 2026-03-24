import { useEffect, useMemo, useState, useRef } from "react";
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
  const businessFormRef = useRef(null);
  const [surveyTypes, setSurveyTypes] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [questionAverages, setQuestionAverages] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [trendData, setTrendData] = useState([]);
  const [pendingVisits, setPendingVisits] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [businessForm, setBusinessForm] = useState({
    name: "",
    location: "",
    priority_level: "medium",
    active: true,
    account_executive_id: ""
  });
  const [accountExecutiveQuery, setAccountExecutiveQuery] = useState("");
  const [message, setMessage] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [selectedAnalyticsBusinessIds, setSelectedAnalyticsBusinessIds] = useState([]);
  const [analyticsBusinessSearch, setAnalyticsBusinessSearch] = useState("");

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

  const representativeMap = useMemo(() => {
    return representatives.reduce((acc, rep) => {
      acc[rep.id] = rep.name;
      return acc;
    }, {});
  }, [representatives]);

  const filteredAnalyticsBusinesses = useMemo(() => {
    const query = analyticsBusinessSearch.trim().toLowerCase();
    if (!query) return businesses;
    return businesses.filter((b) => {
      const name = (b.name || "").toLowerCase();
      const location = (b.location || "").toLowerCase();
      return name.includes(query) || location.includes(query);
    });
  }, [businesses, analyticsBusinessSearch]);

  // Load representatives (account executives)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/representatives`, { headers });
        const data = await res.json();
        if (!res.ok) return;
        setRepresentatives(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load representatives", err);
      }
    };
    load();
  }, [headers]);

  // Business CRUD handlers
  const handleEditBusiness = (business) => {
    setSelectedBusiness(business);
    setBusinessForm({
      name: business.name,
      location: business.location || "",
      priority_level: business.priority_level || "medium",
      active: business.active,
      account_executive_id: business.account_executive_id ? String(business.account_executive_id) : ""
    });
    setAccountExecutiveQuery(
      business.account_executive_id ? representativeMap[business.account_executive_id] || "" : ""
    );
    // Scroll to top of page smoothly, then focus on first input
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Focus first input after scroll completes
      setTimeout(() => {
        const firstInput = businessFormRef.current?.querySelector('input');
        firstInput?.focus();
      }, 500);
    }, 100);
  };

  const handleCreateBusiness = async () => {
    setError("");
    setMessage("");
    if (!businessForm.name.trim()) {
      setError("Business name is required.");
      return;
    }
    const payload = {
      name: businessForm.name.trim(),
      location: businessForm.location.trim() || null,
      priority_level: businessForm.priority_level,
      active: businessForm.active,
      account_executive_id: businessForm.account_executive_id ? Number(businessForm.account_executive_id) : null
    };
    const res = await fetch(`${API_BASE}/api/b2b/businesses`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to create business");
      return;
    }
    setBusinessForm({ name: "", location: "", priority_level: "medium", active: true, account_executive_id: "" });
    setAccountExecutiveQuery("");
    setMessage(`Business created: ${data.name}`);
    await loadBusinesses();
  };

  const handleUpdateBusiness = async () => {
    if (!selectedBusiness) return;
    setError("");
    setMessage("");
    const payload = {
      name: businessForm.name.trim(),
      location: businessForm.location.trim() || null,
      priority_level: businessForm.priority_level,
      active: businessForm.active,
      account_executive_id: businessForm.account_executive_id ? Number(businessForm.account_executive_id) : null
    };
    const res = await fetch(`${API_BASE}/api/b2b/businesses/${selectedBusiness.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to update business");
      return;
    }
    setMessage(`Business updated: ${data.name}`);
    setSelectedBusiness(null);
    setBusinessForm({ name: "", location: "", priority_level: "medium", active: true, account_executive_id: "" });
    setAccountExecutiveQuery("");
    await loadBusinesses();
  };

  const handleRetireBusiness = async (business) => {
    setError("");
    setMessage("");
    const res = await fetch(`${API_BASE}/api/b2b/businesses/${business.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ active: false })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to retire business");
      return;
    }
    setMessage(`Business retired: ${data.name}`);
    await loadBusinesses();
  };

  const handleDeleteBusiness = async (business) => {
    setError("");
    setMessage("");
    const confirmMessage = business.active
      ? `Are you sure you want to delete "${business.name}"? This action cannot be undone.`
      : `Are you sure you want to permanently delete "${business.name}"? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;
    const res = await fetch(`${API_BASE}/api/b2b/businesses/${business.id}`, {
      method: "DELETE",
      headers
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Failed to delete business");
      return;
    }
    setMessage(`Business deleted: ${business.name}`);
    await loadBusinesses();
  };

  const loadBusinesses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/b2b/public/businesses`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load businesses");
        return;
      }
      setBusinesses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load businesses");
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, [headers]);

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
         <>
           {/* Business Form */}
           <Card ref={businessFormRef} className="mb-6">
             <CardHeader>
               <CardTitle>{selectedBusiness ? "Edit Business" : "Create Business"}</CardTitle>
               {selectedBusiness && (
                 <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedBusiness(null); setBusinessForm({ name: "", location: "", priority_level: "medium", active: true, account_executive_id: "" }); setAccountExecutiveQuery(""); }}>
                   Cancel Edit
                 </Button>
               )}
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium mb-1">Business Name</label>
                   <Input value={businessForm.name} onChange={(e) => setBusinessForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Business name" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">Location</label>
                   <Input value={businessForm.location} onChange={(e) => setBusinessForm((prev) => ({ ...prev, location: e.target.value }))} placeholder="Location" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">Priority</label>
                   <Select value={businessForm.priority_level} onChange={(e) => setBusinessForm((prev) => ({ ...prev, priority_level: e.target.value }))}>
                     <option value="high">High</option>
                     <option value="medium">Medium</option>
                     <option value="low">Low</option>
                   </Select>
                 </div>
                 <div>
                   <label className="block text-sm font-medium mb-1">Status</label>
                   <Select value={businessForm.active ? "active" : "inactive"} onChange={(e) => setBusinessForm((prev) => ({ ...prev, active: e.target.value === "active" }))}>
                     <option value="active">Active</option>
                     <option value="inactive">Inactive</option>
                   </Select>
                 </div>
                 <div className="md:col-span-2">
                   <label className="block text-sm font-medium mb-1">Account Executive</label>
                   <Input
                     list="account-executives"
                     value={accountExecutiveQuery}
                     onChange={(e) => {
                       const value = e.target.value;
                       setAccountExecutiveQuery(value);
                       const match = representatives.find((exec) => exec.name.toLowerCase() === value.toLowerCase());
                       setBusinessForm((prev) => ({ ...prev, account_executive_id: match ? String(match.id) : "" }));
                     }}
                     placeholder="Start typing an executive"
                   />
                   <datalist id="account-executives">
                     {representatives.map((exec) => (
                       <option key={exec.id} value={exec.name} />
                     ))}
                   </datalist>
                   <p className="text-xs text-muted-foreground mt-1">Select an executive from the list.</p>
                 </div>
               </div>
               <div className="flex gap-2">
                 <Button type="button" onClick={selectedBusiness ? handleUpdateBusiness : handleCreateBusiness}>
                   {selectedBusiness ? "Update Business" : "Save Business"}
                 </Button>
                 {selectedBusiness && (
                   <Button type="button" variant="outline" onClick={() => { setSelectedBusiness(null); setBusinessForm({ name: "", location: "", priority_level: "medium", active: true, account_executive_id: "" }); setAccountExecutiveQuery(""); }}>
                     Cancel
                   </Button>
                 )}
               </div>
               <p className="text-xs text-muted-foreground">Platform admins can create businesses and set priority.</p>
             </CardContent>
           </Card>

           {/* Business Directory */}
           <Card>
             <CardHeader>
               <CardTitle>Business Directory</CardTitle>
               <Button type="button" variant="outline" size="sm" onClick={loadBusinesses}>Refresh</Button>
             </CardHeader>
             <CardContent>
               <div className="flex gap-2 mb-4">
                 <Input placeholder="Filter by name or location" value={status} onChange={(e) => setStatus(e.target.value)} />
               </div>
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Name</TableHead>
                     <TableHead>Location</TableHead>
                     <TableHead>Priority</TableHead>
                     <TableHead>Account Executive</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {businesses
                     .filter((business) => {
                       if (!status) return true;
                       const query = status.toLowerCase();
                       return (business.name?.toLowerCase().includes(query) || business.location?.toLowerCase().includes(query));
                     })
                     .map((business) => (
                       <TableRow key={business.id} className={!business.location || !business.account_executive_id ? "bg-warning/10" : ""}>
                         <TableCell>{business.name}</TableCell>
                         <TableCell>{business.location || "--"}</TableCell>
                         <TableCell>
                           <Badge variant={business.priority_level === "high" ? "destructive" : business.priority_level === "low" ? "secondary" : "default"}>
                             {business.priority_level || "medium"}
                           </Badge>
                         </TableCell>
                         <TableCell>{representativeMap[business.account_executive_id] || "Unassigned"}</TableCell>
                         <TableCell>
                           <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${business.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                             {business.active ? "Active" : "Retired"}
                           </span>
                         </TableCell>
                         <TableCell>
                           <div className="flex gap-2">
                             <Button type="button" variant="outline" size="sm" onClick={() => handleEditBusiness(business)}>Edit</Button>
                             {business.active && (
                               <Button type="button" variant="outline" size="sm" onClick={() => handleRetireBusiness(business)}>Retire</Button>
                             )}
                             <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteBusiness(business)}>Delete</Button>
                           </div>
                         </TableCell>
                       </TableRow>
                     ))}
                 </TableBody>
               </Table>
             </CardContent>
           </Card>
         </>
       ) : null}
    </PageContainer>
  );
}
