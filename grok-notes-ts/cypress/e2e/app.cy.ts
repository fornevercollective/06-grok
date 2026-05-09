describe('Grok Notes App', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('loads the app', () => {
    cy.contains('.grok').should('be.visible');
    cy.contains('LIVE').should('be.visible');
  });

  it('toggles terminal', () => {
    cy.get('[aria-label="Toggle terminal"]').click();
    // Terminal should toggle (check if it's hidden or shown)
  });

  it('toggles notebook pad', () => {
    cy.get('[aria-label="Toggle notebook pad"]').click();
    // Pad should toggle
  });

  it('toggles notes panel', () => {
    cy.get('[aria-label="Toggle notes panel"]').click();
    // Notes should toggle
  });

  it('toggles drawing tools', () => {
    cy.get('[aria-label="Toggle drawing tools"]').click();
    // Draw should toggle
  });

  it('executes terminal commands', () => {
    cy.get('#term-input').type('help{enter}');
    cy.contains('Available commands').should('be.visible');
  });

  it('adds notes via terminal', () => {
    cy.get('#term-input').type('note Test note{enter}');
    cy.contains('Note added: Test note').should('be.visible');
  });
});