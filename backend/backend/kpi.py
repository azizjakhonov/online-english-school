def dashboard_callback(request, context):
    print("DEBUG: KPI CALLBACK LOADING...")
    
    context.update({
        "kpi": [
            {
                "title": "Students",
                "metric": 150,
                "footer": "Total active",
                "color": "primary",
            },
            {
                "title": "Teachers",
                "metric": 25,
                "footer": "Verified",
                "color": "success",
            },
            {
                "title": "Revenue",
                "metric": 5000,
                "footer": "This month",
                "color": "warning",
            },
        ],
    })
    return context