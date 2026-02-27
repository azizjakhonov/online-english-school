"""
payments/admin.py  – Finance admin for Payment records.
Enhanced with date_hierarchy, CSV export, refund action, and UZS formatting.
"""
import csv
from django.contrib import admin, messages
from django.http import HttpResponse
from django.utils.html import format_html

from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import Payment


def _uzs(value):
    if value is None:
        return '—'
    return f"{int(value):,} UZS".replace(',', '\u202f')


@admin.register(Payment)
class PaymentAdmin(ModelAdmin):
    list_display  = (
        'id', 'get_student', 'amount_col', 'credits_amount',
        'method', 'provider', 'status_badge', 'receipt_id', 'created_at',
    )
    list_filter   = ('status', 'method', 'provider', 'created_at')
    search_fields = ('student__phone_number', 'student__full_name', 'receipt_id')
    ordering      = ('-created_at',)
    date_hierarchy = 'created_at'

    # Fields shown on the detail / add page
    fields = (
        'student', 'credits_amount', 'amount_uzs', 'currency',
        'method', 'provider', 'status',
        'receipt_id', 'last4', 'card_brand', 'card_holder_name',
        'metadata', 'created_at', 'updated_at',
    )
    readonly_fields = (
        'student', 'credits_amount', 'amount_uzs', 'currency',
        'method', 'provider', 'receipt_id',
        'last4', 'card_brand', 'card_holder_name',
        'metadata', 'created_at', 'updated_at',
    )

    actions = ['mark_refunded', 'export_csv']

    # ── Add permission: admin can create manual cash/transfer records ─
    def has_add_permission(self, request):
        return True

    def get_readonly_fields(self, request, obj=None):
        if obj:
            # Editing: everything read-only except status (for refund/cancel)
            return self.readonly_fields
        # Creating a new manual payment: let admin fill core fields
        return ('currency', 'created_at', 'updated_at')

    def has_delete_permission(self, request, obj=None):
        # Only superusers can delete payment records (audit protection)
        return request.user.is_superuser

    # ── Display helpers ──
    def get_student(self, obj):
        return obj.student.full_name or obj.student.phone_number
    get_student.short_description = 'Student'
    get_student.admin_order_field = 'student__full_name'

    def amount_col(self, obj):
        return _uzs(obj.amount_uzs)
    amount_col.short_description = 'Amount (UZS)'
    amount_col.admin_order_field = 'amount_uzs'

    @display(description='Status', label=True)
    def status_badge(self, obj):
        color_map = {
            'pending':   'orange', 'succeeded': 'green',
            'failed':    'red',    'refunded':  'purple', 'canceled': 'gray',
        }
        return obj.get_status_display(), color_map.get(obj.status, 'gray')

    # ── Actions ──
    @admin.action(description='💸 Mark selected as Refunded')
    def mark_refunded(self, request, queryset):
        if not request.user.is_superuser:
            messages.error(request, "Only superusers can mark payments as refunded.")
            return
        n = queryset.exclude(status='refunded').update(status='refunded')
        messages.success(request, f"Marked {n} payment(s) as Refunded.")

    @admin.action(description='📥 Export selected as CSV')
    def export_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="payments.csv"'
        w = csv.writer(response)
        w.writerow(['ID', 'Student', 'Amount UZS', 'Credits', 'Method', 'Provider', 'Status', 'Receipt ID', 'Date'])
        for p in queryset.select_related('student'):
            w.writerow([
                p.id,
                p.student.full_name or p.student.phone_number,
                int(p.amount_uzs),
                p.credits_amount,
                p.method, p.provider, p.status,
                p.receipt_id,
                p.created_at.strftime('%Y-%m-%d %H:%M'),
            ])
        return response
