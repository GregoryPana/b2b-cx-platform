"""Professional PDF report generation with charts, colors, and styling."""

import io
from datetime import datetime
from typing import Any
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import numpy as np

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle,
    Flowable, KeepTogether
)
from reportlab.pdfgen import canvas as pdfcanvas
from xml.sax.saxutils import escape as _xml_escape


# Brand colors (hex strings for matplotlib compatibility)
CWS_NAVY_HEX = "#0B1F45"
CWS_BLUE_HEX = "#0056A1"
CWS_SKY_HEX = "#3B9EE8"
CWS_TEAL_HEX = "#0FA3B1"
CWS_LIME_HEX = "#84CC16"
CWS_AMBER_HEX = "#F59E0B"
CWS_RED_HEX = "#EF4444"
CWS_SLATE_HEX = "#475569"
CWS_LIGHT_HEX = "#F1F5F9"

# ReportLab color objects
CWS_NAVY = colors.HexColor(CWS_NAVY_HEX)
CWS_BLUE = colors.HexColor(CWS_BLUE_HEX)
CWS_SKY = colors.HexColor(CWS_SKY_HEX)
CWS_TEAL = colors.HexColor(CWS_TEAL_HEX)
CWS_LIME = colors.HexColor(CWS_LIME_HEX)
CWS_AMBER = colors.HexColor(CWS_AMBER_HEX)
CWS_RED = colors.HexColor(CWS_RED_HEX)
CWS_SLATE = colors.HexColor(CWS_SLATE_HEX)
CWS_LIGHT = colors.HexColor(CWS_LIGHT_HEX)
CWS_WHITE = colors.white
CWS_BORDER = colors.HexColor("#E5E7EB")


def score_color(val: float | None) -> str:
    """Return hex color based on score."""
    if val is None:
        return "#64748B"
    val = float(val)
    if val >= 8.0:
        return "#84CC16"
    elif val >= 6.5:
        return "#F59E0B"
    return "#EF4444"


def fig_to_image(fig, width_mm: float = 170, height_mm: float | None = None) -> Image:
    """Convert matplotlib figure to ReportLab Image."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', facecolor='white', dpi=150)
    buf.seek(0)
    img_width = width_mm * mm
    if height_mm:
        img_height = height_mm * mm
    else:
        fw, fh = fig.get_size_inches()
        img_height = img_width * (fh / fw)
    plt.close(fig)
    return Image(buf, width=img_width, height=img_height)


class KPIStrip(Flowable):
    """Row of color-coded metric tiles."""

    def __init__(self, items: list[tuple[str, str, str]], width: float = None):
        Flowable.__init__(self)
        self.items = items  # (label, value, hex_color)
        self._w = width or (A4[0] - 30 * mm)
        self.height = 22 * mm

    def draw(self):
        c = self.canv
        tile_w = self._w / len(self.items)
        for i, (label, value, col) in enumerate(self.items):
            x = i * tile_w
            c.setFillColor(colors.HexColor(col))
            c.roundRect(x + 1*mm, 1*mm, tile_w - 2*mm, self.height - 2*mm,
                       radius=3, fill=1, stroke=0)
            c.setFillColor(CWS_WHITE)
            c.setFont("Helvetica-Bold", 14)
            c.drawCentredString(x + tile_w/2, 11*mm, str(value))
            c.setFont("Helvetica", 6.5)
            c.drawCentredString(x + tile_w/2, 5.5*mm, label.upper())


class SectionHeader(Flowable):
    """Navy divider bar with left accent strip."""

    def __init__(self, text: str, width: float = None):
        Flowable.__init__(self)
        self.text = text
        self._w = width or (A4[0] - 30 * mm)
        self.height = 10 * mm

    def draw(self):
        c = self.canv
        c.setFillColor(CWS_NAVY)
        c.rect(0, 0, self._w, self.height, fill=1, stroke=0)
        c.setFillColor(CWS_SKY)
        c.rect(0, 0, 4, self.height, fill=1, stroke=0)
        c.setFillColor(CWS_WHITE)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(8*mm, 3.2*mm, self.text.upper())


class HeaderFooterCanvas(pdfcanvas.Canvas):
    """Canvas with header/footer on each page."""

    def __init__(self, *args, **kwargs):
        pdfcanvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_chrome(num_pages)
            pdfcanvas.Canvas.showPage(self)
        pdfcanvas.Canvas.save(self)

    def draw_chrome(self, page_count: int):
        if self._pageNumber == 1:
            return

        W, H = A4
        # Header bar
        self.setFillColor(CWS_NAVY)
        self.rect(0, H - 15*mm, W, 12*mm, fill=1, stroke=0)

        self.setFillColor(CWS_WHITE)
        self.setFont("Helvetica-Bold", 9)
        self.drawString(15*mm, H - 10*mm, "CABLE & WIRELESS SEYCHELLES | B2B CX REPORT")

        # Footer
        self.setFillColor(CWS_SLATE)
        self.setFont("Helvetica", 8)
        self.drawString(15*mm, 8*mm, "CONFIDENTIAL — Internal Use Only")
        self.drawRightString(W - 15*mm, 8*mm, f"Page {self._pageNumber} of {page_count}")


def render_report_pdf(payload: dict[str, Any], generated_by: str) -> bytes:
    """Generate professional PDF report with charts and styling."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=35*mm, bottomMargin=15*mm
    )

    story = []
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=CWS_NAVY,
        spaceAfter=6,
        alignment=1
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=10,
        textColor=CWS_SLATE,
        spaceAfter=8,
        leading=14
    )

    filters = payload.get("filters", {})
    summary = payload.get("summary", {})
    comparison = payload.get("analytics_comparison", {})
    action_points = payload.get("action_points", [])
    business_breakdown = payload.get("business_breakdown", [])
    category_comparison = payload.get("category_comparison", [])
    survey_questions = payload.get("survey_question_details", [])

    # Cover page (just a page break for now)
    story.append(PageBreak())

    # Executive Summary Header
    story.append(SectionHeader("EXECUTIVE SUMMARY"))
    story.append(Spacer(1, 4*mm))

    # KPI Strip
    kpi_items = [
        (f"Total Visits", str(summary.get('total_visits', 0)), CWS_BLUE_HEX),
        (f"Approved", str(summary.get('status_counts', {}).get('Approved', 0)), CWS_LIME_HEX),
        (f"Draft", str(summary.get('status_counts', {}).get('Draft', 0)), "#94A3B8"),
        (f"Businesses", str(summary.get('total_businesses', 0)), CWS_TEAL_HEX),
        (f"Avg Score", str(round(float(summary.get('average_score', 0)), 2)), CWS_AMBER_HEX),
        (f"NPS", str(round(float(comparison.get('nps', {}).get('selected', 0)), 1)), CWS_SKY_HEX),
    ]
    story.append(KPIStrip(kpi_items))
    story.append(Spacer(1, 6*mm))

    # Executive Summary Text
    avg_score = float(summary.get('average_score', 7.5))
    risk_level = "above" if avg_score >= 7.5 else "below"
    summary_text = f"""
    Cable & Wireless Seychelles B2B account manager survey activity from {filters.get('survey_type', 'B2B')} surveys.
    A total of {summary.get('total_visits', 0)} visits were recorded across {summary.get('total_businesses', 0)} businesses.
    The portfolio-wide average score of {avg_score:.2f} / 10 sits {risk_level} the internal target of 7.5.
    Generated by: {generated_by}
    """
    story.append(Paragraph(summary_text.strip(), body_style))
    story.append(Spacer(1, 4*mm))

    # Key Findings Box
    findings = [
        f"Total responses: {summary.get('total_responses', 0)}",
        f"Relationship score: {comparison.get('relationship_score', {}).get('selected', 'N/A')}",
        f"CSAT: {comparison.get('csat', {}).get('selected', 'N/A')}%",
        f"Outstanding actions: {len([a for a in action_points if a.get('action_status') != 'Completed'])}",
    ]
    findings_text = " | ".join(findings)

    finding_para = Paragraph(f"<b>Key Metrics:</b> {findings_text}", body_style)
    story.append(finding_para)
    story.append(Spacer(1, 8*mm))

    # Visit Status & Coverage Section
    story.append(SectionHeader("VISIT STATUS & COVERAGE"))
    story.append(Spacer(1, 4*mm))

    # Charts: Visit Status & Visits per Business
    if business_breakdown:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))

        # Donut chart - Visit Status
        status_counts = summary.get('status_counts', {})
        statuses = list(status_counts.keys())
        counts = list(status_counts.values())
        colors_pie = [CWS_LIME_HEX if s == 'Approved' else '#94A3B8' for s in statuses]

        wedges, texts, autotexts = ax1.pie(
            counts, labels=statuses, autopct='%1.0f',
            colors=colors_pie, startangle=90,
            wedgeprops=dict(width=0.5, edgecolor='white', linewidth=2)
        )
        ax1.set_title("Visit Status", fontsize=11, fontweight='bold')
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontweight('bold')

        # Horizontal bar - Visits per Business
        biz_names = [b.get('business_name', '--')[:15] for b in business_breakdown[:8]]
        biz_counts = [b.get('visit_count', 0) for b in business_breakdown[:8]]

        ax2.barh(biz_names, biz_counts, color=CWS_SKY_HEX)
        ax2.set_xlabel("Number of Visits", fontsize=9)
        ax2.set_title("Visits per Business", fontsize=11, fontweight='bold')
        ax2.set_axisbelow(True)

        fig.tight_layout()
        story.append(fig_to_image(fig, width_mm=170, height_mm=60))
        story.append(Spacer(1, 4*mm))

    # Score Analysis Section
    if business_breakdown:
        story.append(SectionHeader("SCORE ANALYSIS — BUSINESS & CATEGORY"))
        story.append(Spacer(1, 4*mm))

        # Score by Business with color grading
        fig, ax = plt.subplots(figsize=(10, 4))

        biz_names = [b.get('business_name', '--')[:15] for b in business_breakdown]
        biz_scores = [float(b.get('avg_score', 0)) if b.get('avg_score') else 0 for b in business_breakdown]

        bar_colors = [score_color(s) for s in biz_scores]
        bars = ax.barh(biz_names, biz_scores, color=bar_colors)

        ax.axvline(x=7.5, color=CWS_AMBER_HEX, linestyle='--', linewidth=2, alpha=0.7, label='Target 7.5')
        ax.set_xlabel("Average Score (0–10)", fontsize=9)
        ax.set_title("Average Score by Business", fontsize=11, fontweight='bold')
        ax.set_xlim(0, 10)
        ax.legend(loc='lower right', fontsize=8)

        # Add value labels
        for i, (bar, score) in enumerate(zip(bars, biz_scores)):
            if score > 0:
                ax.text(score + 0.1, i, f'{score:.2f}', va='center', fontsize=8, fontweight='bold')

        fig.tight_layout()
        story.append(fig_to_image(fig, width_mm=170, height_mm=65))
        story.append(Spacer(1, 4*mm))

    # Category Breakdown Section
    if category_comparison:
        story.append(SectionHeader("CATEGORY BREAKDOWN"))
        story.append(Spacer(1, 4*mm))

        fig, ax = plt.subplots(figsize=(10, 3))

        cat_names = [c.get('category', '--')[:20] for c in category_comparison[:6]]
        cat_scores = [float(c.get('selected_average_score', 0)) if c.get('selected_average_score') else 0
                     for c in category_comparison[:6]]

        bar_colors = [score_color(s) for s in cat_scores]
        ax.barh(cat_names, cat_scores, color=bar_colors)
        ax.set_xlabel("Average Score", fontsize=9)
        ax.set_xlim(0, 10)
        ax.set_title("Category Score Summary", fontsize=11, fontweight='bold')

        fig.tight_layout()
        story.append(fig_to_image(fig, width_mm=170, height_mm=55))
        story.append(Spacer(1, 2*mm))

        # Category details table
        cat_data = [["Category", "Score"]]
        for c in category_comparison[:10]:
            score = c.get('selected_average_score', '--')
            score_str = f"{float(score):.2f}" if score and score != '--' else "--"
            cat_data.append([c.get('category', '--'), score_str])

        cat_table = Table(cat_data, colWidths=[130*mm, 30*mm])
        cat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), CWS_NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), CWS_WHITE),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, CWS_BORDER),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CWS_WHITE, CWS_LIGHT]),
        ]))
        story.append(cat_table)
        story.append(Spacer(1, 6*mm))

    # Selected Visit Info Section (for survey-specific reports)
    selected_visit = payload.get("selected_visit_info", {})
    if selected_visit and selected_visit.get("business_name"):
        story.append(SectionHeader("SURVEY DETAILS"))
        story.append(Spacer(1, 4*mm))

        visit_info_text = f"""
        <b>Business:</b> {selected_visit.get('business_name', '--')} |
        <b>Visit Date:</b> {selected_visit.get('visit_date', '--')} |
        <b>Status:</b> {selected_visit.get('status', '--')}<br/>
        <b>Account Executive:</b> {selected_visit.get('account_executive_name', '--')} |
        <b>Representative:</b> {selected_visit.get('representative_name', '--')}
        """
        if selected_visit.get('team_member_names'):
            team = ', '.join(selected_visit.get('team_member_names', []))
            visit_info_text += f"<br/><b>Team Members:</b> {team}"

        story.append(Paragraph(visit_info_text, body_style))
        story.append(Spacer(1, 6*mm))

    # Action Points Section
    if action_points:
        outstanding = [a for a in action_points if a.get("action_status") != "Completed"]

        if outstanding:
            story.append(SectionHeader("ACTION POINTS"))
            story.append(Spacer(1, 4*mm))

            # Build question lookup dictionary (fallback for question_number/text)
            question_lookup = {}
            for q in survey_questions:
                q_id = q.get('question_id')
                q_num = q.get('question_number')
                if q_id is not None:
                    question_lookup[q_id] = q
                if q_num is not None:
                    question_lookup[q_num] = q

            # Wrapping style for the question cell so full text is preserved
            question_cell_style = ParagraphStyle(
                'ActionQuestion', parent=styles['BodyText'],
                fontSize=7, leading=9, textColor=CWS_SLATE,
            )

            # Action Points Table with related questions (full text + number)
            action_data = [["Business", "Related Question", "Action Required", "Timeframe", "Status"]]
            for item in outstanding[:12]:
                business = item.get('business_name', '--')[:20]

                # The action point carries question_id/text/number directly; fall
                # back to the survey question lookup if any field is missing.
                q_id = item.get('question_id')
                related_q = question_lookup.get(q_id, {}) if q_id is not None else {}
                q_num = item.get('question_number') or related_q.get('question_number')
                q_text = item.get('question_text') or related_q.get('question_text') or ''
                q_text_safe = _xml_escape(str(q_text)) if q_text else ''

                if q_num and q_text_safe:
                    question_info = f"<b>Q{q_num}:</b> {q_text_safe}"
                elif q_num:
                    question_info = f"<b>Q{q_num}</b>"
                elif q_text_safe:
                    question_info = q_text_safe
                else:
                    question_info = "--"

                action = _xml_escape(str(item.get('action_required', '--'))[:80])
                timeframe = item.get('action_timeframe', '--')
                status = item.get('action_status', '--')

                action_data.append([
                    business,
                    Paragraph(question_info, question_cell_style),
                    Paragraph(action, question_cell_style),
                    timeframe,
                    status
                ])

            action_table = Table(action_data, colWidths=[22*mm, 58*mm, 45*mm, 18*mm, 17*mm])
            action_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), CWS_NAVY),
                ('TEXTCOLOR', (0, 0), (-1, 0), CWS_WHITE),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('FONTSIZE', (0, 1), (-1, -1), 7),
                ('GRID', (0, 0), (-1, -1), 0.5, CWS_BORDER),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CWS_WHITE, CWS_LIGHT]),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))

            story.append(action_table)
            story.append(Spacer(1, 6*mm))

    # Business Account Summary Section
    if business_breakdown:
        story.append(SectionHeader("BUSINESS ACCOUNT SUMMARY"))
        story.append(Spacer(1, 4*mm))

        biz_data = [["Business", "Visits", "Avg Score", "Latest Visit"]]
        for item in business_breakdown[:10]:
            score = item.get('avg_score', '--')
            score_str = f"{float(score):.2f}" if score and score != '--' else "--"
            biz_data.append([
                item.get('business_name', '--'),
                str(item.get('visit_count', 0)),
                score_str,
                item.get('latest_visit', '--')[:10]
            ])

        biz_table = Table(biz_data, colWidths=[60*mm, 25*mm, 30*mm, 30*mm])
        biz_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), CWS_NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), CWS_WHITE),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, CWS_BORDER),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CWS_WHITE, CWS_LIGHT]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))

        story.append(biz_table)
        story.append(Spacer(1, 6*mm))

    # Survey Questions Section
    if survey_questions:
        story.append(SectionHeader("SURVEY RESPONSES"))
        story.append(Spacer(1, 4*mm))

        sq_data = [["Question", "Answer", "Verbatim"]]
        for item in survey_questions[:15]:
            qnum = item.get("question_number", "--")
            qtext = item.get("question_text", "--")[:40]
            answer = item.get("answer_text") or (f"{item.get('score')}/{item.get('score_max')}" if item.get("score") else "--")
            verbatim = item.get("verbatim", "")[:40] if item.get("verbatim") else ""
            sq_data.append([f"Q{qnum}: {qtext}", str(answer)[:20], str(verbatim)])

        sq_table = Table(sq_data, colWidths=[80*mm, 35*mm, 45*mm])
        sq_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), CWS_NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), CWS_WHITE),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, CWS_BORDER),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CWS_WHITE, CWS_LIGHT]),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(sq_table)
        story.append(Spacer(1, 6*mm))

    # Build PDF
    doc.build(story, canvasmaker=HeaderFooterCanvas)
    pdf_bytes = buffer.getvalue()

    if not pdf_bytes or len(pdf_bytes) == 0:
        raise ValueError("PDF generation failed - no output")

    return pdf_bytes
