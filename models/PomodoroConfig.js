class PomodoroConfig {

    static STATUS = {
        ACTIVE: 0,
        PAUSED: 1,
        ENDED: 2,
        CANCELLED: 3
    }

    static PHASES = {
        FOCUS: {
            name: "Concentración",
            duration: 25
        },
        SHORT_BREAK: {
            name: "Descanso Corto",
            duration: 5
        },
        LONG_BREAK: {
            name: "Descanso Largo",
            duration: 10
        },
        END: {
            name: "Fin",
            duration: 0
        }
    }

    static PHASE_ORDER = [
        PomodoroConfig.PHASES.FOCUS,
        PomodoroConfig.PHASES.SHORT_BREAK,
        PomodoroConfig.PHASES.FOCUS,
        PomodoroConfig.PHASES.SHORT_BREAK,
        PomodoroConfig.PHASES.FOCUS,
        PomodoroConfig.PHASES.SHORT_BREAK,
        PomodoroConfig.PHASES.FOCUS,
        PomodoroConfig.PHASES.LONG_BREAK,
        PomodoroConfig.PHASES.END
    ]

    static FOCUS_PHRASES = [
        '¡Vamos allá! Es hora de enfocarse en el trabajo. 💪🏼⏰',
        'El reloj Pomodoro está en marcha. ¡Hora de ser productivo! 🍅💼',
        'Es momento de concentrarse en la tarea en cuestión. ¡A darle duro! 🤓💪🏼',
        '¡Es hora de entrar en la zona de concentración! Como un personaje en el juego, ¡mantén el enfoque y completa la tarea! 🎮🤓',
        '¡Hora de trabajar! Enfócate en la tarea y no te distraigas. 🤓👀',
        '¡Es hora de trabajar! ¡No te distraigas! 🤓👀',
        'Concentrémonos en la tarea y veremos resultados satisfactorios. 🤞🏼👀',
        'Trabajemos con orden y enfoque para alcanzar nuestras metas. 📈🎯',
        'Con determinación y esfuerzo, lograremos nuestros objetivos en esta sesión de trabajo. 💪🏼💼',
        '¡Listos para la siguiente ronda! Elige tu arma (o lápiz y papel) y ¡prepárate para la acción! 🔫📝',
        'Con cada tarea completada, sube de nivel. ¡El camino hacia el éxito está lleno de desafíos, pero eres capaz de superarlos todos! 🏆👊🏼',
        'Vamos a enfocarnos en la tarea y alcanzar nuestros objetivos. 🤓🎯',
        'Es momento de concentrarse y avanzar en el trabajo. 💻🚀',
        '¡A trabajar con determinación y compromiso! 🧑🏻‍💼💪🏼',
    ]

    static SHORT_BREAK_PHRASES = [
        '¡Excelente trabajo! Tómate un breve descanso merecido. 🙌🏼😴',
        'Tómate un respiro. ¡Descansa y relájate durante unos minutos! ☕️😌',
        'Desconéctate un poco para volver a la tarea renovado. ¡Disfruta del descanso corto! 🧘🏻‍♀️🌴',
        'Descansa y recupera tus puntos de vida. ¡El siguiente nivel será aún más emocionante! 🕹️😴',
        '¡Hora de un respiro! Tómate unos minutos para descansar y volver con más energía. 🙌🏼🤸🏻‍♀️',
        'Unos minutos de descanso para despejar la mente y volver con más fuerza. 🧘🏻‍♀️🧠',
        'Tómate unos minutos para estirarte y mover el cuerpo antes de continuar. 🙆🏻‍♀️💃🏻',
        '¡Hora de un respiro! Tómate unos minutos para descansar y volver con más energía. 🙌🏼🤸🏻‍♀️',
        'En este descanso, disfruta de una bebida energética (o tu bebida favorita) para recargar y volver al trabajo con más energía. 🥤💥',
        'Tómate un respiro para recargar energías y volver a la tarea con más fuerza. 🌬️💪',
        'Desconecta un poco para volver a la tarea con mente y cuerpo renovados. 🧘🏻‍♂️🧠',
        'Un breve descanso para disfrutar de un pequeño placer y continuar con más ánimo. 🍵😌',
        '"Un guerrero sabio sabe cuándo retirarse y descansar su cuerpo." - Ezio Auditore, Assassin\'s Creed 🤜🏼🤛🏼💥',

    ]

    static LONG_BREAK_PHRASES = [
        '¡Buen trabajo! Ahora tómate un descanso más largo. 🙌🏼😴',
        'Es hora de recargar energías.Tómate un descanso más prolongado. ⏰💤',
        'Descansa y relájate un poco más para volver renovado. ¡Aprovecha el descanso largo! 🧘🏻‍♂️🌅',
    ]

    static EMOJIS_BAR = {
        FIRST_EMPTY: "<:bar1:1096134440377385180>",
        FIRST_FULL: "<:bar2:1096134442302570586>",
        MIDDLE_EMPTY: "<:bar5:1096134446937276497>",
        MIDDLE_FULL: "<:bar6:1096134448438845470>",
        LAST_EMPTY: "<:bar3:1096134443623792791>",
        LAST_FULL: "<:bar4:1096134444944998552>"
    }

}

module.exports = PomodoroConfig;