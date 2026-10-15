import { GoogleGenAI } from "@google/genai";

const ai= new GoogleGenAI();

export interface surgePredictionResult{
    predictedMultiplier : number;
    demandTrend: 'LOW' | 'MEDIUM' | 'HIGH' |'CRITICAL';
    recommendedDriverRelocationCount : number;
    reasoning: string
}


export class aiDemandService {
    static async predictSurge(params:{
        h3Index: string;
        currentSupply: number;
        currentDemand: number;
    }): Promise<surgePredictionResult> {
        const{ h3Index, currentDemand, currentSupply } = params;
        const currentHour = new Date().getHours();
        const isWeekend = [0,6].includes(new Date().getDay());

        const prompt = `
        You are an advanced AI mobility logistics and dynamic pricing engine for a ride-sharing platform.
        Analyze the following geospatial telemetry snapshot:
        - H3 Cell Index: ${h3Index}
        - Current Active Drivers (Supply): ${currentSupply}
        - Ride Requests in Last 5-10 mins (Demand): ${currentDemand}
        - Current Local Hour: ${currentHour}:00
        - Weekend: ${isWeekend}

        Predict the demand surge multiplier for the next 15-30 minutes.
        Return strictly a valid JSON object matching this schema without any markdown formatting or code blocks:
        {
        "predictedMultiplier": <number between 1.0 and 2.5 rounded to 2 decimals>,
        "demandTrend": "<LOW | MEDIUM | HIGH | CRITICAL>",
        "recommendedDriverRelocationCount": <integer count of idle drivers to route into this cell>,
        "reasoning": "<concise 1-sentence analytical reason>"
        }
        `;


        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    temperature: 0.2, // Deterministic scoring
            },
        });

        const responseText = response.text?.trim() || '{}';
        const parsed: surgePredictionResult = JSON.parse(responseText);

        //multiplier safety bounds(1x to 2.5x)
        parsed.predictedMultiplier = Math.min(Math.max(parsed.predictedMultiplier || 1,1),2.5);

        return parsed;

        } catch (error) {
            console.warn('AI Predictive Surge fallback triggered:', error);


            //fallback calculation in case of rate limits
            const fallbackRatio = currentDemand/Math.max(currentSupply,1);
            const fallbackMultiplier = fallbackRatio > 3 ? 2.5 : (fallbackRatio > 1.5 ? 1.5 :1);

            return {
                predictedMultiplier : fallbackMultiplier ,
                demandTrend: fallbackMultiplier > 2 ? 'LOW' : 'HIGH',
                recommendedDriverRelocationCount : Math.max(0,currentDemand-currentSupply),
                reasoning: 'Fallback heuristic calculation applied due to AI service timeout.'  
            }
        }
    }  
}