
import reflex as rx

config = rx.Config(
    app_name="phantom",
    tailwind={
        "theme": {
            "extend": {
                "colors": {
                    "accent": "#00ff41",
                    "surface": "#050505",
                    "plate": "#0a0a0a",
                },
            },
        },
    },
)
