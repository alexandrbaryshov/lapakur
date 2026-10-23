// Возможности Motion (анимации, наведение, нажатие) — отдельным чанком после гидрации:
// первый экран рисуется пререндером, а JS первого экрана укладывается в бюджет (R36).
import { domAnimation } from "motion/react";

export default domAnimation;
