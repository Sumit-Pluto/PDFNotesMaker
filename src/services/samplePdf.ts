import jsPDF from 'jspdf';
import type { PdfDocumentInfo } from '../types';

export function generateSamplePdfDocument(): PdfDocumentInfo {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Helper colors
  const primaryColor: [number, number, number] = [37, 99, 235]; // Royal blue
  const darkTextColor: [number, number, number] = [30, 41, 59]; // Slate 800
  const lightBgColor: [number, number, number] = [241, 245, 249]; // Slate 100
  const accentColor: [number, number, number] = [124, 58, 237]; // Purple

  // ===================== PAGE 1 =====================
  // Document Header
  doc.setFillColor(...lightBgColor);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...primaryColor);
  doc.text('COMPUTER SCIENCE 301: MACHINE LEARNING', 15, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Lecture 04: Deep Neural Networks & Backpropagation Notes', 15, 24);
  doc.text('Prof. A. Henderson • MIT Courseware', 140, 24);

  // Filler paragraph 1 (typical textbook filler)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Disclaimer: This chapter contains background introductory remarks, historical contexts, reading assignments,\nand syllabus outlines. Students should focus on the highlighted formulas and architecture diagrams below.',
    15,
    38
  );

  // IMPORTANT NOTE BOX 1: Definition of Artificial Neuron (Good for snipping!)
  doc.setFillColor(238, 242, 255); // Indigo 50
  doc.setDrawColor(99, 102, 241); // Indigo 500
  doc.setLineWidth(0.8);
  doc.roundedRect(15, 48, 180, 45, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('CORE DEFINITION: Multi-Layer Perceptron (MLP)', 20, 56);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkTextColor);
  doc.text(
    'A feedforward artificial neural network consisting of at least three layers of nodes: an input layer,\na hidden layer, and an output layer. Except for the input nodes, each node is a neuron that uses a\nnonlinear activation function.',
    20,
    64
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...accentColor);
  doc.text('y = f(W^T * x + b)    where f in {ReLU, GELU, Sigmoid}', 20, 82);

  // Unimportant filler text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Historical note: In 1958 Frank Rosenblatt invented the perceptron at Cornell Aeronautical Laboratory.\nThe original perceptron was intended to be a machine rather than a program, with hardware wired custom pots.\nMany early critics like Minsky & Papert showed XOR limitations before multi-layer backprop emerged.',
    15,
    102
  );

  // IMPORTANT DIAGRAM / FORMULA BOX 2: Activation Functions Table
  doc.setFillColor(240, 253, 244); // Emerald 50
  doc.setDrawColor(34, 197, 94); // Emerald 500
  doc.setLineWidth(0.8);
  doc.roundedRect(15, 118, 180, 52, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(21, 128, 61); // Green 700
  doc.text('KEY FORMULAS: Non-Linear Activation Functions', 20, 126);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkTextColor);
  doc.text('1. ReLU (Rectified Linear Unit):', 22, 134);
  doc.setFont('courier', 'normal');
  doc.text('f(x) = max(0, x),  f\'(x) = 1 if x > 0 else 0', 78, 134);

  doc.setFont('helvetica', 'bold');
  doc.text('2. Sigmoid Function:', 22, 143);
  doc.setFont('courier', 'normal');
  doc.text('sigma(x) = 1 / (1 + e^(-x)),  sigma\'(x) = sigma(x)*(1 - sigma(x))', 78, 143);

  doc.setFont('helvetica', 'bold');
  doc.text('3. GELU (Gaussian Error Linear):', 22, 152);
  doc.setFont('courier', 'normal');
  doc.text('f(x) = x * Phi(x) approx 0.5x * (1 + tanh(sqrt(2/pi)*(x + 0.044715x^3)))', 78, 152);

  doc.setFont('helvetica', 'bold');
  doc.text('4. Softmax (Multi-class):', 22, 161);
  doc.setFont('courier', 'normal');
  doc.text('P(y = i | x) = exp(z_i) / sum_j exp(z_j)', 78, 161);

  // IMPORTANT DIAGRAM BOX 3: Gradient Descent Rule
  doc.setFillColor(254, 242, 242); // Rose 50
  doc.setDrawColor(239, 68, 68); // Rose 500
  doc.setLineWidth(0.8);
  doc.roundedRect(15, 178, 180, 38, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(185, 28, 28);
  doc.text('CRITICAL EQUATION: Gradient Descent Weight Update', 20, 186);

  doc.setFont('courier', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(153, 27, 27);
  doc.text('theta_(t+1) = theta_t - eta * nabla_theta L(theta_t)', 25, 196);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('eta: Learning rate (step size). Too large causes divergence; too small slows convergence.', 20, 206);

  // Page Footer filler
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 175);
  doc.text('Lecture 04 • MIT OpenCourseWare • Page 1', 105, 285, { align: 'center' });

  // ===================== PAGE 2 =====================
  doc.addPage('a4', 'portrait');

  // Header Page 2
  doc.setFillColor(...lightBgColor);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text('LECTURE 04 (CONT.): LOSS FUNCTIONS & BACKPROPAGATION', 15, 14);

  // Filler paragraph
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Before continuing with the chain rule derivations, remember that project milestone 2 is due this Friday.\nLate submissions will be docked 10% per day. Office hours are held Wednesdays at 4 PM in Building 34.',
    15,
    30
  );

  // IMPORTANT NOTE BOX 4: Loss Functions cheat sheet
  doc.setFillColor(254, 249, 195); // Amber 50
  doc.setDrawColor(217, 119, 6); // Amber 600
  doc.setLineWidth(0.8);
  doc.roundedRect(15, 40, 180, 50, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(180, 83, 9);
  doc.text('EXAM CHEAT-SHEET: Standard Loss Functions (L)', 20, 48);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkTextColor);
  doc.text('A. Mean Squared Error (Regression):', 22, 56);
  doc.setFont('courier', 'normal');
  doc.text('L_MSE = (1/N) * sum_i (y_i - y_hat_i)^2', 88, 56);

  doc.setFont('helvetica', 'bold');
  doc.text('B. Binary Cross-Entropy (Binary Class):', 22, 66);
  doc.setFont('courier', 'normal');
  doc.text('L_BCE = -[y * log(p) + (1 - y) * log(1 - p)]', 88, 66);

  doc.setFont('helvetica', 'bold');
  doc.text('C. Categorical Cross-Entropy (Multi):', 22, 76);
  doc.setFont('courier', 'normal');
  doc.text('L_CE = - sum_k y_k * log(p_k)', 88, 76);

  // IMPORTANT BOX 5: The Chain Rule for Backpropagation
  doc.setFillColor(245, 243, 255); // Violet 50
  doc.setDrawColor(139, 92, 246); // Violet 500
  doc.setLineWidth(0.8);
  doc.roundedRect(15, 98, 180, 60, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...accentColor);
  doc.text('THE BACKPROPAGATION CHAIN RULE', 20, 107);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkTextColor);
  doc.text(
    'For any node j in layer l with pre-activation z_j and post-activation a_j:\nError signal delta_j^(l) = partial L / partial z_j^(l)',
    20,
    115
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(109, 40, 217);
  doc.text('delta_j^(l) = ( sum_k delta_k^(l+1) * W_kj^(l+1) ) * f\'(z_j^(l))', 22, 130);
  doc.text('partial L / partial W_jk^(l) = a_k^(l-1) * delta_j^(l)', 22, 140);
  doc.text('partial L / partial b_j^(l) = delta_j^(l)', 22, 150);

  // Filler paragraph
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Notice how error propagates backwards from output layer L to input layer 1.\nComputational complexity per sample is O(E) where E is the total number of weights (edges).\nVectorized implementations utilize BLAS matrix multiplications for GPU throughput.',
    15,
    170
  );

  // IMPORTANT BOX 6: Optimizer Comparison
  doc.setFillColor(240, 249, 255); // Sky 50
  doc.setDrawColor(2, 132, 199); // Sky 600
  doc.setLineWidth(0.8);
  doc.roundedRect(15, 190, 180, 50, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(3, 105, 161);
  doc.text('OPTIMIZER SUMMARY: Adam vs SGD + Momentum', 20, 198);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkTextColor);
  doc.text('• SGD with Momentum:', 22, 207);
  doc.setFont('courier', 'normal');
  doc.text('v_t = beta * v_(t-1) + (1-beta)*g_t;  theta_t = theta_(t-1) - eta*v_t', 58, 207);

  doc.setFont('helvetica', 'bold');
  doc.text('• Adam (Adaptive Moments):', 22, 217);
  doc.setFont('courier', 'normal');
  doc.text('m_t = beta_1 * m_(t-1) + (1-beta_1)*g_t', 58, 217);
  doc.text('v_t = beta_2 * v_(t-1) + (1-beta_2)*g_t^2', 58, 224);
  doc.text('theta_t = theta_(t-1) - eta * (m_hat_t / (sqrt(v_hat_t) + eps))', 58, 231);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 175);
  doc.text('Lecture 04 • MIT OpenCourseWare • Page 2', 105, 285, { align: 'center' });

  // ===================== PAGE 3: Dark Landscape Lecture Slide (PhysicsWallah style) =====================
  doc.addPage('a4', 'l'); // 297mm x 210mm
  // Pitch black slide background
  doc.setFillColor(10, 14, 23);
  doc.rect(0, 0, 297, 210, 'F');

  // Top slide header & PW logo badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(245, 158, 11); // Amber / Gold
  doc.text('II)  CONCATENATION OVER OR (DISTRIBUTIVE LAW)', 24, 25);

  doc.setDrawColor(236, 72, 153);
  doc.setLineWidth(0.6);
  doc.roundedRect(250, 14, 28, 16, 8, 8, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(236, 72, 153);
  doc.text('PW', 264, 24, { align: 'center' });

  // Left Note badge ("It holds" in green with green underline)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(34, 197, 94); // Emerald
  doc.text('It holds', 30, 60, { angle: 30 });
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.8);
  doc.line(26, 63, 50, 48);

  // Left explanation
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(226, 232, 240);
  doc.text('Concatenation\nis distributed\nover OR', 28, 90);

  // i) Left Distribution
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(56, 189, 248); // Cyan
  doc.text('i) Left Distribution:', 95, 50);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(245, 158, 11); // Golden orange
  doc.text('a . ( b + c )  =  ( a . b ) + ( a . c )', 110, 75);

  // Curved arrow hint
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(148, 163, 184);
  doc.text('{ a b , a c }', 135, 92);

  // ii) Right Distribution
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(56, 189, 248); // Cyan
  doc.text('ii) Right Distribution:', 95, 120);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(245, 158, 11); // Golden orange
  doc.text('( a + b ) . c  =  ( a . c ) + ( b . c )', 110, 145);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(148, 163, 184);
  doc.text('{ a c , b c }', 135, 162);

  // Bottom slide footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Theory of Computation • Formal Languages & Automata • Slide 13', 148, 198, { align: 'center' });

  // Output as Uint8Array
  const arrayBuffer = doc.output('arraybuffer');
  const uint8 = new Uint8Array(arrayBuffer);

  return {
    id: 'sample-ml-notes',
    name: 'CS-Discrete-Math-and-ML-Slides.pdf',
    size: uint8.byteLength,
    numPages: 3,
    data: uint8,
  };
}
