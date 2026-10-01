package com.anonqr.app.ui.components

import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.anonqr.app.ui.theme.EmeraldDark
import com.anonqr.app.ui.theme.EmeraldLight
import com.anonqr.app.ui.theme.EmeraldPrimary

enum class MascotVariant {
    HERO, GAME, CONFESSION, SCANNER, COMPACT
}

@Composable
fun AnonQrMascot(
    modifier: Modifier = Modifier,
    variant: MascotVariant = MascotVariant.HERO,
    size: Dp = 120.dp
) {
    // Gentle Floating Animation
    val infiniteTransition = rememberInfiniteTransition(label = "float")
    val offsetY by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = -12f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "offsetY"
    )

    Box(
        modifier = modifier
            .size(size)
            .offset(y = offsetY.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(size)) {
            val width = this.size.width
            val height = this.size.height
            val scale = width / 200f

            // 1. Antena
            val antennaPath = Path().apply {
                moveTo(100f * scale, 50f * scale)
                quadraticBezierTo(102f * scale, 30f * scale, 105f * scale, 15f * scale)
            }
            drawPath(
                path = antennaPath,
                color = EmeraldPrimary,
                style = Stroke(width = 4f * scale)
            )
            drawCircle(
                color = EmeraldLight,
                radius = 8f * scale,
                center = Offset(105f * scale, 15f * scale)
            )
            drawCircle(
                color = Color.White,
                radius = 4f * scale,
                center = Offset(105f * scale, 15f * scale)
            )

            // 2. Pernas e Pés Humanóides
            val footPathLeft = Path().apply {
                moveTo(85f * scale, 160f * scale)
                lineTo(80f * scale, 185f * scale)
                quadraticBezierTo(70f * scale, 190f * scale, 88f * scale, 192f * scale)
                lineTo(95f * scale, 160f * scale)
            }
            drawPath(footPathLeft, color = EmeraldDark)

            val footPathRight = Path().apply {
                moveTo(115f * scale, 160f * scale)
                lineTo(120f * scale, 185f * scale)
                quadraticBezierTo(130f * scale, 190f * scale, 112f * scale, 192f * scale)
                lineTo(105f * scale, 160f * scale)
            }
            drawPath(footPathRight, color = EmeraldDark)

            // 3. Tronco / Corpo Humanoide
            drawOval(
                color = EmeraldDark,
                topLeft = Offset(75f * scale, 130f * scale),
                size = Size(50f * scale, 45f * scale)
            )

            // 4. Braços e Mãos Acenando
            val armLeft = Path().apply {
                moveTo(75f * scale, 135f * scale)
                quadraticBezierTo(55f * scale, 130f * scale, 48f * scale, 115f * scale)
            }
            drawPath(armLeft, color = EmeraldPrimary, style = Stroke(width = 5f * scale))
            drawCircle(color = EmeraldLight, radius = 5f * scale, center = Offset(48f * scale, 115f * scale))

            val armRight = Path().apply {
                moveTo(125f * scale, 135f * scale)
                quadraticBezierTo(145f * scale, 140f * scale, 152f * scale, 150f * scale)
            }
            drawPath(armRight, color = EmeraldPrimary, style = Stroke(width = 5f * scale))
            drawCircle(color = EmeraldLight, radius = 5f * scale, center = Offset(152f * scale, 150f * scale))

            // 5. Cabeça Alienígena Oval
            val headPath = Path().apply {
                moveTo(100f * scale, 45f * scale)
                quadraticBezierTo(155f * scale, 45f * scale, 155f * scale, 95f * scale)
                quadraticBezierTo(155f * scale, 135f * scale, 100f * scale, 135f * scale)
                quadraticBezierTo(45f * scale, 135f * scale, 45f * scale, 95f * scale)
                quadraticBezierTo(45f * scale, 45f * scale, 100f * scale, 45f * scale)
            }
            drawPath(
                path = headPath,
                brush = Brush.radialGradient(
                    colors = listOf(EmeraldLight, EmeraldPrimary, EmeraldDark),
                    center = Offset(100f * scale, 85f * scale),
                    radius = 65f * scale
                )
            )

            // 6. Olhos Grandes Amendoados
            // Olho Esquerdo
            drawOval(
                color = Color(0xFF0F172A),
                topLeft = Offset(62f * scale, 75f * scale),
                size = Size(28f * scale, 36f * scale)
            )
            drawOval(
                color = Color(0xFF0284C7),
                topLeft = Offset(66f * scale, 80f * scale),
                size = Size(18f * scale, 24f * scale)
            )
            drawCircle(color = Color.White, radius = 4f * scale, center = Offset(74f * scale, 84f * scale))

            // Olho Direito
            drawOval(
                color = Color(0xFF0F172A),
                topLeft = Offset(110f * scale, 75f * scale),
                size = Size(28f * scale, 36f * scale)
            )
            drawOval(
                color = Color(0xFF0284C7),
                topLeft = Offset(116f * scale, 80f * scale),
                size = Size(18f * scale, 24f * scale)
            )
            drawCircle(color = Color.White, radius = 4f * scale, center = Offset(124f * scale, 84f * scale))

            // 7. Sorriso Simpático
            val mouthPath = Path().apply {
                moveTo(90f * scale, 118f * scale)
                quadraticBezierTo(100f * scale, 126f * scale, 110f * scale, 118f * scale)
            }
            drawPath(mouthPath, color = Color(0xFF064E3B), style = Stroke(width = 3f * scale))

            // Bochechinhas
            drawCircle(color = Color(0x55F43F5E), radius = 6f * scale, center = Offset(60f * scale, 114f * scale))
            drawCircle(color = Color(0x55F43F5E), radius = 6f * scale, center = Offset(140f * scale, 114f * scale))
        }
    }
}
