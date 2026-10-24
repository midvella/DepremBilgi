
const Charts = {
    magnitudeChart: null,
    timelineChart: null,
    depthChart: null,
    regionChart: null,

    init() {
        Chart.defaults.color = 'rgba(255,255,255,0.7)';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
        Chart.defaults.font.family = "'Inter', sans-serif";
    },

    updateMagnitudeChart(earthquakes) {
        const ctx = document.getElementById('magnitude-chart');
        if (!ctx) return;

        const ranges = [
            { label: '0-2', min: 0, max: 2, color: '#63e09e' },
            { label: '2-3', min: 2, max: 3, color: '#a8e063' },
            { label: '3-4', min: 3, max: 4, color: '#ffc800' },
            { label: '4-5', min: 4, max: 5, color: '#ff9500' },
            { label: '5-6', min: 5, max: 6, color: '#ff6b35' },
            { label: '6+', min: 6, max: 99, color: '#ff2d2d' }
        ];

        const data = ranges.map(r => ({
            label: r.label,
            count: earthquakes.filter(eq => eq.mag >= r.min && eq.mag < r.max).length,
            color: r.color
        }));

        if (this.magnitudeChart) {
            this.magnitudeChart.destroy();
        }

        this.magnitudeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => `M ${d.label}`),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: data.map(d => d.color),
                    borderColor: 'rgba(15, 15, 35, 0.8)',
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 12,
                            usePointStyle: true,
                            pointStyleWidth: 12,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 15, 35, 0.95)',
                        borderColor: 'rgba(255, 107, 53, 0.3)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        titleFont: { weight: 'bold' },
                        callbacks: {
                            label: (ctx) => `  ${ctx.parsed} deprem`
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 1200,
                    easing: 'easeOutQuart'
                }
            }
        });
    },

    updateTimelineChart(earthquakes) {
        const ctx = document.getElementById('timeline-chart');
        if (!ctx) return;

        const now = new Date();
        const hours = [];
        const counts = [];

        for (let i = 23; i >= 0; i--) {
            const hourStart = new Date(now - i * 3600000);
            const hourEnd = new Date(now - (i - 1) * 3600000);
            const hourLabel = hourStart.toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Istanbul'
            });

            hours.push(hourLabel);
            counts.push(earthquakes.filter(eq => {
                const eqDate = new Date(eq.date);
                return eqDate >= hourStart && eqDate < hourEnd;
            }).length);
        }

        if (this.timelineChart) {
            this.timelineChart.destroy();
        }

        this.timelineChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hours,
                datasets: [{
                    label: 'Deprem Sayısı',
                    data: counts,
                    backgroundColor: (ctx) => {
                        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
                        gradient.addColorStop(0, 'rgba(255, 107, 53, 0.8)');
                        gradient.addColorStop(1, 'rgba(255, 107, 53, 0.1)');
                        return gradient;
                    },
                    borderColor: 'rgba(255, 107, 53, 0.9)',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 15, 35, 0.95)',
                        borderColor: 'rgba(255, 107, 53, 0.3)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => `  ${ctx.parsed.y} deprem`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 45,
                            font: { size: 9 },
                            maxTicksLimit: 12
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: { size: 10 }
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.04)'
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    },

    updateDepthChart(earthquakes) {
        const ctx = document.getElementById('depth-chart');
        if (!ctx) return;

        const ranges = [
            { label: '0-5 km', min: 0, max: 5 },
            { label: '5-10 km', min: 5, max: 10 },
            { label: '10-30 km', min: 10, max: 30 },
            { label: '30-70 km', min: 30, max: 70 },
            { label: '70+ km', min: 70, max: 9999 }
        ];

        const data = ranges.map(r =>
            earthquakes.filter(eq => eq.depth >= r.min && eq.depth < r.max).length
        );

        const colors = ['#00e5ff', '#00bcd4', '#0097a7', '#00695c', '#004d40'];

        if (this.depthChart) {
            this.depthChart.destroy();
        }

        this.depthChart = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: ranges.map(r => r.label),
                datasets: [{
                    data: data,
                    backgroundColor: colors.map(c => c + '99'),
                    borderColor: colors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            usePointStyle: true,
                            font: { size: 10 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 15, 35, 0.95)',
                        borderColor: 'rgba(0, 229, 255, 0.3)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => `  ${ctx.parsed.r} deprem`
                        }
                    }
                },
                scales: {
                    r: {
                        ticks: {
                            display: false
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.06)'
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    },

    updateRegionChart(earthquakes) {
        const ctx = document.getElementById('region-chart');
        if (!ctx) return;

        const cities = {};
        earthquakes.forEach(eq => {
            const city = eq.city || 'Bilinmiyor';
            cities[city] = (cities[city] || 0) + 1;
        });

        const sorted = Object.entries(cities)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const gradientColors = [
            '#ff6b35', '#ff9500', '#ffc800', '#a8e063',
            '#63e09e', '#00e5ff', '#7c4dff', '#e040fb'
        ];

        if (this.regionChart) {
            this.regionChart.destroy();
        }

        this.regionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(s => s[0]),
                datasets: [{
                    label: 'Deprem Sayısı',
                    data: sorted.map(s => s[1]),
                    backgroundColor: gradientColors.slice(0, sorted.length).map(c => c + 'cc'),
                    borderColor: gradientColors.slice(0, sorted.length),
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 15, 35, 0.95)',
                        borderColor: 'rgba(255, 107, 53, 0.3)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => `  ${ctx.parsed.x} deprem`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: { size: 10 }
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.04)'
                        }
                    },
                    y: {
                        ticks: { font: { size: 11 } },
                        grid: { display: false }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    },

    updateAll(earthquakes) {
        this.updateMagnitudeChart(earthquakes);
        this.updateTimelineChart(earthquakes);
        this.updateDepthChart(earthquakes);
        this.updateRegionChart(earthquakes);
    }
};
