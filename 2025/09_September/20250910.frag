// Crystal Shader with Theme Colors

uniform float uTime;
uniform vec2 uResolution;

// Theme color palette
const vec3 deepPurple = vec3(0.212, 0.176, 0.471);  // #362d78
const vec3 richPurple = vec3(0.322, 0.247, 0.639);  // #523fa3  
const vec3 lavender = vec3(0.569, 0.424, 0.800);    // #916ccc
const vec3 lightLavender = vec3(0.741, 0.631, 0.898); // #bda1e5
const vec3 paleBlue = vec3(0.784, 0.753, 0.914);    // #c8c0e9
const vec3 skyBlue = vec3(0.518, 0.729, 0.906);     // #84bae7
const vec3 brightBlue = vec3(0.318, 0.416, 0.831);  // #516ad4
const vec3 darkBlue = vec3(0.200, 0.247, 0.529);    // #333f87

// Noise function for organic crystal patterns
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Enhanced sparkle function - creates brilliant star-like points
float sparkle(vec2 p, float time) {
    vec2 grid = floor(p);
    vec2 frac = fract(p);
    
    float sparkleValue = 0.0;
    
    // Check surrounding cells for sparkles
    for(int x = -1; x <= 1; x++) {
        for(int y = -1; y <= 1; y++) {
            vec2 cellPos = grid + vec2(x, y);
            vec2 sparklePos = fract(sin(cellPos * mat2(127.1, 311.7, 269.5, 183.3)) * 43758.5453);
            
            // More dramatic timing animation
            float sparkleTime = fract(time * 0.8 + sparklePos.x * 6.28);
            float intensity = pow(smoothstep(0.5, 1.0, sparkleTime) * smoothstep(1.0, 0.5, sparkleTime), 0.5);
            
            // Distance from sparkle center
            vec2 sparkleOffset = sparklePos + vec2(x, y) - frac;
            float dist = length(sparkleOffset);
            
            // Create simple, elegant star shape (like before)
            float star = max(0.0, 1.0 - dist * 10.0) * intensity;
            
            // Simple cross pattern for classic star
            float cross1 = max(0.0, 1.0 - abs(sparkleOffset.x) * 20.0);
            float cross2 = max(0.0, 1.0 - abs(sparkleOffset.y) * 20.0);
            
            star *= (cross1 + cross2);
            
            sparkleValue += star;
        }
    }
    
    return min(sparkleValue, 3.0); // Limit maximum brightness
}

out vec4 fragColor;
void main()
{
    vec2 uv = vUV.st;
    vec2 centeredUV = (uv - 0.5) * 2.0;
    float time = uTime * 0.3;
    
    // Step 1: Distance-based coloring
    float dist = length(centeredUV);
    vec3 baseColor = mix(deepPurple, skyBlue, dist);
    
    // Step 2: Add animated noise for crystal structure
    vec2 noiseUV = uv * 4.0 + time * 0.5;
    float crystalNoise = fbm(noiseUV);
    
    // Step 3: Create multiple color layers
    vec3 innerColor = mix(richPurple, brightBlue, sin(time + dist * 3.0) * 0.5 + 0.5);
    vec3 outerColor = mix(lightLavender, paleBlue, crystalNoise);
    
    // Blend layers based on distance
    vec3 layeredColor = mix(innerColor, outerColor, smoothstep(0.2, 0.8, dist));
    
    // Add noise variation
    vec3 baseResult = mix(layeredColor, lavender, crystalNoise * 0.2);
    
    // Step 4: Add sparkle effects at different scales
    float bigSparkles = sparkle(uv * 6.0, time);
    float mediumSparkles = sparkle(uv * 12.0, time * 1.5);
    float smallSparkles = sparkle(uv * 18.0, time * 2.2);
    
    // Create mask to avoid sparkles in crystal center
    float sparkleDistance = length(centeredUV);
    float sparkleMask = smoothstep(0.2, 0.4, sparkleDistance);
    
    // Combine sparkle layers with mask applied
    float totalSparkles = (bigSparkles * 1.5 + mediumSparkles * 1.0 + smallSparkles * 0.7) * sparkleMask;
    
    // Create brilliant sparkle colors that shift dramatically
    vec3 sparkleColor1 = mix(paleBlue * 2.0, brightBlue * 2.5, sin(time * 3.0) * 0.5 + 0.5);
    vec3 sparkleColor2 = mix(lightLavender * 1.8, skyBlue * 2.2, cos(time * 2.5) * 0.5 + 0.5);
    vec3 finalSparkleColor = mix(sparkleColor1, sparkleColor2, sin(time * 4.0) * 0.5 + 0.5);
    
    // Add sparkles with much higher brightness multiplier
    vec3 finalColor = baseResult + finalSparkleColor * totalSparkles * 2.0;
    
    fragColor = TDOutputSwizzle(vec4(finalColor, 1.0));
}
