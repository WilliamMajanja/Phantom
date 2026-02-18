
import reflex as rx
from .state import State, Track, Message

# --- STYLES ---
COMMON_STYLE = {
    "font_family": "JetBrains Mono, monospace",
    "color": "#e0e0e0",
    "background_color": "#050505",
}

GLASS_PANEL = {
    "background": "rgba(8, 8, 8, 0.85)",
    "border": "1px solid rgba(0, 255, 65, 0.1)",
    "backdrop_filter": "blur(12px)",
}

# --- COMPONENTS ---

def header() -> rx.Component:
    return rx.hstack(
        rx.hstack(
            rx.box(
                rx.text("P", font_weight="900", font_size="1.2rem"),
                border="1px solid #333",
                padding_x="10px",
                background="black",
            ),
            rx.vstack(
                rx.text("PHANTOM", font_weight="bold", font_size="0.9rem", line_height="1"),
                rx.text("INFINITY COLLABORATIONS SDH", font_size="0.5rem", color="#00ff41", letter_spacing="0.1em"),
                spacing="0",
            ),
            spacing="3",
        ),
        rx.spacer(),
        rx.hstack(
            rx.vstack(
                rx.text("CPU TEMP", font_size="0.5rem", color="#555"),
                rx.text(f"{State.cpu_temp}°C", font_size="0.7rem", color="#00ff41"),
                spacing="0", align="end"
            ),
            rx.button(
                "DATA_EXFIL",
                variant="outline",
                size="1",
                color_scheme="gray",
                font_size="0.6rem",
            ),
            spacing="4",
        ),
        width="100%",
        padding="1rem",
        border_bottom="1px solid rgba(255,255,255,0.05)",
        background="rgba(0,0,0,0.8)",
    )

def nav_rail() -> rx.Component:
    tabs = ["SEQUENCER", "PERFORMANCE", "PATCHBAY", "NETWORK"]
    return rx.hstack(
        rx.hstack(
            *[
                rx.button(
                    tab,
                    on_click=lambda t=tab: State.set_tab(t),
                    background=rx.cond(State.active_tab == tab, "#00ff41", "transparent"),
                    color=rx.cond(State.active_tab == tab, "black", "#555"),
                    font_size="0.6rem",
                    padding_x="1.5rem",
                    border_radius="0",
                    height="2.5rem",
                    _hover={"color": "white"}
                )
                for tab in tabs
            ],
            spacing="0",
        ),
        width="100%",
        border_bottom="1px solid #222",
    )

def render_track(track: Track) -> rx.Component:
    return rx.hstack(
        rx.box(
            rx.text(track.name, font_size="0.6rem", font_weight="bold", text_align="right"),
            width="100px",
        ),
        rx.hstack(
            rx.foreach(
                track.steps,
                lambda active, idx: rx.box(
                    width="2rem",
                    height="2rem",
                    background=rx.cond(active, "#00ff41", "#111"),
                    border="1px solid #222",
                    on_click=lambda: State.update_step(track.id, idx),
                    cursor="pointer",
                    box_shadow=rx.cond(active, "0 0 10px #00ff41", "none"),
                ),
            ),
            spacing="1",
        ),
        padding_y="2",
        width="100%",
    )

def ghost_bridge_sidebar() -> rx.Component:
    return rx.drawer.root(
        rx.drawer.trigger(
            rx.button(
                "● GHOST_LINK",
                position="fixed",
                bottom="2rem",
                right="2rem",
                background="black",
                border="1px solid rgba(0, 255, 65, 0.5)",
                color="#00ff41",
                font_size="0.6rem",
                z_index="100",
            )
        ),
        rx.drawer.overlay(background="rgba(0,0,0,0.5)"),
        rx.drawer.content(
            rx.vstack(
                rx.hstack(
                    rx.text("GHOST_BRIDGE", font_weight="bold", font_size="0.8rem", letter_spacing="0.2em"),
                    rx.spacer(),
                    rx.drawer.close(rx.icon("x", size=18, cursor="pointer")),
                    width="100%",
                    padding="1rem",
                    border_bottom="1px solid #222",
                ),
                rx.box(
                    rx.vstack(
                        rx.foreach(
                            State.chat_history,
                            lambda msg: rx.vstack(
                                rx.text(msg.role, font_size="0.5rem", opacity=0.5),
                                rx.box(
                                    rx.text(msg.text),
                                    padding="0.75rem",
                                    border=rx.cond(msg.role == "USER", "1px solid #333", "1px solid rgba(0,255,65,0.3)"),
                                    background=rx.cond(msg.role == "USER", "#111", "rgba(0,255,65,0.05)"),
                                    font_size="0.7rem",
                                ),
                                align=rx.cond(msg.role == "USER", "end", "start"),
                                width="100%",
                                spacing="1",
                            )
                        ),
                        spacing="4",
                        width="100%",
                    ),
                    height="70vh",
                    overflow_y="auto",
                    padding="1rem",
                    width="100%",
                ),
                rx.vstack(
                    rx.input(
                        placeholder="ENTER COMMAND...",
                        value=State.current_prompt,
                        on_change=State.set_current_prompt,
                        on_key_down=rx.cond(rx.event.key == "Enter", State.handle_chat_submit),
                        background="#080808",
                        border="1px solid #333",
                        font_family="JetBrains Mono",
                        font_size="0.7rem",
                        width="100%",
                    ),
                    rx.hstack(
                        rx.text("MODEL: GEMINI-1.5-FLASH", font_size="0.4rem", opacity=0.4),
                        rx.spacer(),
                        rx.text("CONTEXT: LIVE", font_size="0.4rem", opacity=0.4),
                        width="100%",
                    ),
                    padding="1rem",
                    width="100%",
                    border_top="1px solid #222",
                ),
                height="100%",
                background="#050505",
                color="white",
                font_family="JetBrains Mono",
            ),
            width="400px",
        ),
        direction="right",
    )

def index() -> rx.Component:
    return rx.box(
        rx.script(src="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"),
        header(),
        nav_rail(),
        rx.main(
            rx.cond(
                State.active_tab == "SEQUENCER",
                rx.vstack(
                    rx.hstack(
                        rx.vstack(
                            rx.text("BPM", font_size="0.5rem", color="#555"),
                            rx.text(State.bpm, font_size="1.5rem", font_weight="bold"),
                            spacing="0",
                        ),
                        rx.spacer(),
                        rx.button(
                            rx.cond(State.playing, "STOP", "PLAY"),
                            on_click=State.toggle_play,
                            color_scheme=rx.cond(State.playing, "red", "green"),
                            variant="ghost",
                        ),
                        width="100%",
                        padding="1rem",
                        style=GLASS_PANEL,
                    ),
                    rx.box(
                        rx.vstack(
                            rx.foreach(State.tracks, render_track),
                            width="100%",
                        ),
                        style=GLASS_PANEL,
                        padding="2rem",
                        width="100%",
                    ),
                    spacing="4",
                    width="100%",
                    max_width="1200px",
                    margin_x="auto",
                    padding="2rem",
                )
            ),
            width="100%",
            height="calc(100vh - 8rem)",
            overflow_y="auto",
        ),
        ghost_bridge_sidebar(),
        style=COMMON_STYLE,
        width="100%",
        height="100vh",
    )

app = rx.App()
app.add_page(index)
